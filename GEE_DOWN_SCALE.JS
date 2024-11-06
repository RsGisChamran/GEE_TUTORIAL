Map.centerObject(table);
Map.addLayer(table);
var filterDate = ee.Filter.date('2019-01-01' , '2020-01-01');
var cloud = 30;
//var PATH =159;
//var ROW = 35;

var LST = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
.filterBounds(table)
.filter(filterDate)
.filter(ee.Filter.lessThan('CLOUD_COVER',cloud))
//.filter(ee.Filter.eq('TARGET_WRS_PATH',PATH))
//.filter(ee.Filter.eq('TARGET_WRS_ROW',ROW))
.mean()
.clip(table)
.select('ST_B10')
.multiply(0.00341802).add(149.0)
.subtract(273.15)
.rename('LST');
print(LST, 'LST')
Map.addLayer(LST,{min:15 , max:58},'LST',false);

var ndvi = ee.ImageCollection('COPERNICUS/S2')
.filterBounds(table)
.filter(filterDate)
.filter(ee.Filter.lessThan('CLOUDY_PIXEL_PERCENTAGE',30))
.map(function(img){
  return img.normalizedDifference(['B8','B4']);
})
.median()
.clip(table)
.rename('ndvi');
Map.addLayer(ndvi,{min:-1 , max:1},'ndvi',false);



var ndbi = ee.ImageCollection('COPERNICUS/S2')
.filterBounds(table)
.filter(filterDate)
.filter(ee.Filter.lessThan('CLOUDY_PIXEL_PERCENTAGE',30))
.map(function(img){
  return img.normalizedDifference(['B11','B8']);
})
.median()
.clip(table)
.rename('ndbi');
Map.addLayer(ndbi,{min:-1 , max:1},'ndbi',false);

var ndwi = ee.ImageCollection('COPERNICUS/S2')
.filterBounds(table)
.filter(filterDate)
.filter(ee.Filter.lessThan('CLOUDY_PIXEL_PERCENTAGE',30))
.map(function(img){
  return img.normalizedDifference(['B3','B8']);
})
.median()
.clip(table)
.rename('ndwi');
Map.addLayer(ndwi,{min:-1 , max:1},'ndwi',false);

var rain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
.filterBounds(table)
.filter(filterDate)
.select('precipitation')
.sum()
.clip(table)
.rename('rain')
Map.addLayer(rain,{min:0 , max:400},'rain',false);


var DEM = ee.Image("USGS/SRTMGL1_003")
.select('elevation')
.clip(table)
.rename('DEM');


var combind = ee.Image([LST,ndvi,ndbi,ndwi,DEM]);
print(combind,'combind')


var sampling = combind.sample({
  numPixels:10000,
  region:table, 
  scale:100,
  geometries:true}).randomColumn();
  
  Map.addLayer(sampling,{},'sampling',false)
  
  
  var train = sampling.filter(ee.Filter.lte('random',0.7));
  var test = sampling.filter(ee.Filter.gt('random',0.7));
  
  print('train_size',train.size(),'test_size',test.size());
  
  
  var regression = ee.Classifier.smileRandomForest(50).train(train,'LST',['ndvi','ndbi','ndwi','DEM'])
  .setOutputMode('REGRESSION');
  
  print('info regression',regression.explain());
  
  var perdiction_LST = combind.classify(regression,'perdiction_LST');
  Map.addLayer(perdiction_LST,{},'perdiction_LST');
  
  Export.image.toDrive({
image:ndbi,
description:'ndbi',
scale:20,
region:table,
maxPixels:1e9
});
  
  
  
  var testData = test.classify(regression,'perdiction_LST').map(function(data){

return data.set('LST_PER',data.get('LST'))
});

var chart = ui.Chart.feature.byFeature(testData, 'LST', ['LST_PER','perdiction_LST'])
.setChartType('ScatterChart')
.setOptions({

title:'LST Actual vs LST Prediction',
vAxis:{title:'LST Prediction'},
hAxis:{title:'LST Actual'},
series:{
0:{pointsVisible:false},
1:{pointSize:1,color:'black'}
},
trendlines: {
1: { // add a trend line to the 1st series
type: 'linear', // or 'polynomial', 'exponential'
color: 'red',
lineWidth: 1,
opacity: 0.8,
visibleInLegend: true,
showR2:true
}
}

});

print(chart);
  
  
  

