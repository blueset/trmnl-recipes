/**
 * @typedef {Object} InputType
 * @property {KMLObject} IDX_0
 * @property {KMLObject} IDX_1
 * @property {KMLObject} IDX_2
 * @property {TrmnlObject} trmnl
 * 
 * @typedef {Object} TrmnlObject
 * @property {PluginSettingsObject} plugin_settings
 * 
 * @typedef {Object} PluginSettingsObject
 * @property {CustomFieldValues} custom_fields_values
 * 
 * @typedef {Object} CustomFieldValues
 * @property {string} travelTimeKeywords
 * @property {string} cameraKeywords
 * @property {string} alertBBox
 *
 * @typedef {Object} KMLObject
 * @property {KML} kml
 * 
 * @typedef {Object} KML
 * @property {KMLDocument} Document
 *
 * @typedef {Object} KMLDocument
 * @property {KMLFolder[]} Folder
 *
 * @typedef {Object} KMLFolder
 * @property {string} name
 * @property {string} description
 * @property {KMLPlacemark[]} Placemark
 *
 * @typedef {Object} KMLPlacemark
 * @property {string} name
 * @property {string} description
 * @property {string} [styleUrl]
 * @property {KMLPoint} Point
 *
 * @typedef {Object} KMLPoint
 * @property {string} coordinates
 */

/**
 * @param {KMLFolder[]} folders
 */
function processTravelTimeFolders(folders) {
  return folders.flatMap(folder =>
    (Array.isArray(folder.Placemark) ? folder.Placemark : []).map(placemark => {
      const html = placemark.description || '';
      const description = html.match(/<\/div><p>(.*?)<\/p>/)?.[1] || '';
      const origin = html.match(/From '(.*?)'/)?.[1] || '';
      const destination = html.match(/' To '(.*?)'/)?.[1] || '';
      const currentTravelTime = html.match(/Current Travel Time: (\d+)/)?.[1] || '';
      const averageTravelTime = html.match(/Average Travel Time: (\d+)/)?.[1] || '';
      const updatedString = html.match(/Last Updated At: (.*?)<\/b>/)?.[1] || '';
      const updatedISO8601 = new Date(updatedString + ' GMT-0800').toISOString();
      return {
        title: placemark.name,
        updated: updatedISO8601,
        description,
        origin,
        destination,
        currentTravelTime,
        averageTravelTime,
      }
    })
  );
}

/**
 * @param {KMLFolder[]} folders
 */
function processCameras(folders) {
  return folders.flatMap(folder => 
    (Array.isArray(folder.Placemark) ? folder.Placemark : []).map(placemark => {
      const coordinates = placemark.Point.coordinates.split(',').map(Number);
      const url = placemark.description.match(/src="(.*?)"/)?.[1] || '';
      return {
        name: placemark.name,
        url: url,
        coordinates: {
          longitude: coordinates[0],
          latitude: coordinates[1],
        },
        folder: folder.name,
      };
    })
  );
}

/**
 * @param {KMLFolder[]} folders
 */
function processAlerts(folders) {
  return folders.flatMap(folder => 
    (Array.isArray(folder.Placemark) ? folder.Placemark : []).map(placemark => {
      const severityName = placemark.description.match(/^<div>(.*?)<\/div><div>/)?.[1] || '';
      const severityLevel = placemark.styleUrl ? placemark.styleUrl.match(/^#([A-Z][a-z]*)/)?.[1] : '';
      const alertType = (placemark.styleUrl ? placemark.styleUrl.match(/^#[A-Z][a-z]*(.*)$/)?.[1] : '').replace(/([A-Z])/g, ' $1').trim();
      const coordinates = placemark.Point.coordinates.split(',').map(Number);
      return {
        content: placemark.name,
        severityName,
        severityLevel,
        alertType,
        folder: folder.name,
        coordinates: {
          longitude: coordinates[0],
          latitude: coordinates[1],
        },
      };
    })
  ).toSorted((a, b) => {
    const severityOrder = { "Highest": 0, "High": 1, "Medium": 2, "Low": 3 };
    const aScore = (severityOrder[a.severityLevel] ?? 4) * 2 + (a.alertType === "Closure" ? 0 : 1);
    const bScore = (severityOrder[b.severityLevel] ?? 4) * 2 + (b.alertType === "Closure" ? 0 : 1);
    return aScore - bScore;
  });
}

/**
 * @param {InputType} input
 */
function transform(input) {
  const travelTimeFolders = input.IDX_0.kml.Document.Folder;
  const travelTimeKeywords = (input.trmnl.plugin_settings.custom_fields_values.travelTimeKeywords || '')
    .split(',')
    .map(item => item.trim().replaceAll(' to ', '-').replaceAll('I-', '').replaceAll('SR ', ''));
  const processedTrafficTime = processTravelTimeFolders(travelTimeFolders).filter(item => {
    return travelTimeKeywords.some(keyword => item.title.includes(keyword.trim()));
  }).slice(0, 20);

  const [left, bottom, right, top] = (input.trmnl.plugin_settings.custom_fields_values.alertBBox.match(
    /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/
  ) ? input.trmnl.plugin_settings.custom_fields_values.alertBBox : '-126,45,-116.1,49.6').split(',').map(Number);
  const alertFolders = input.IDX_1.kml.Document.Folder;
  const alerts = processAlerts(alertFolders).filter(item => {
    const lon = item.coordinates.longitude;
    const lat = item.coordinates.latitude;
    return lon >= left && lon <= right && lat >= bottom && lat <= top;
  }).slice(0, 10);

  const cameraKeywords = (input.trmnl.plugin_settings.custom_fields_values.cameraKeywords || '').split(',');
  const cameraFolders = input.IDX_2.kml.Document.Folder;
  const cameras = processCameras(cameraFolders).filter(item => {
    return cameraKeywords.some(keyword => item.name.includes(keyword.trim()));
  }).slice(0, 10);

  return {
    trafficTime: processedTrafficTime,
    cameras: cameras,
    alerts: alerts,
    trmnl: input.trmnl,
  };
}