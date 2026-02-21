# Washington DOT Real-time Travel Info

Real-time travel info from Washington State Department of Transportation (WSDOT). Show travel times, traffic cameras, and alerts on your dashboard. Data powered by [WSDOT Traffic API](https://wsdot.com/traffic/api/).

[Install](https://trmnl.com/recipes/227171)

## Screenshot

### Alerts

| Full | Vertical |
| :---: | :---: |
| ![Screenshot](./images/f-alerts.png) | ![Screenshot](./images/v-alerts.png) |
| Horizontal | Quad |
| ![Screenshot](./images/h-alerts.png) | ![Screenshot](./images/q-alerts.png) |

### Travel Time

| Full | Vertical |
| :---: | :---: |
| ![Screenshot](./images/f-time.png) | ![Screenshot](./images/v-time.png) |
| Horizontal | Quad |
| ![Screenshot](./images/h-time.png) | ![Screenshot](./images/q-time.png) |

### Traffic Cameras

| Full | Vertical |
| :---: | :---: |
| ![Screenshot](./images/f-cameras.png) | ![Screenshot](./images/v-cameras.png) |
| Horizontal | Quad |
| ![Screenshot](./images/h-cameras.png) | ![Screenshot](./images/q-cameras.png) |

## Parameters

- Content to show  
  Travel time / Traffic cameras / Alerts, default: Travel time
- Name of travel time monitors  
  Names are matched partially. Find travel time monitors at [WSDOT Real-Time Travel Map](https://wsdot.com/Travel/Real-time/Map/?layers=travel-time).
- Name of traffic cameras  
  Names are matched partially. Find traffic cameras at [WSDOT Real-Time Travel Map](https://wsdot.com/Travel/Real-time/Map/?layers=camera).
- Area to show alerts for  
  Coordinate bounding box to filter alerts. Format: "left,bottom,right,top". Find coordinates at [bbox tool](https://norbertrenner.de/osm/bbox.html?zoom=8&lat=47.48661&lon=-120.73199&layers=FBT).
