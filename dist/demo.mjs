export function demoRoute(image) {
  const item = (id, title, action, source, miles, stops, centralized, waypoint, details = []) => ({
    id, title, action, source, miles, stops, centralized, regular: 0, waypoint, details,
  });
  return {
    version: 1, id: 'FICTIONAL-SAMPLE', name: 'Sample route', area: 'Alder Park · Practice route',
    miles: 2.14, effective: '',
    map: image ? {
      image, width: 850, height: 560, bounds: { north: 45.003, south: 44.9974, west: -123.005, east: -122.9965 },
    } : null,
    steps: [
      item(1, 'Alder Street', 'north', 'Head north on Alder Street.', .19, 0, 0, [44.9986, -123.00375]),
      item(2, 'Juniper Lane', 'right', 'Turn right onto Juniper Lane and service the cluster boxes.', .32, 2, 24, [45.0000, -123.00375], ['Service the cluster boxes along Juniper Lane.']),
      item(3, 'Parkside Drive', 'left', 'Turn left onto Parkside Drive.', .24, 0, 0, [45.0000, -123.0005]),
      item(4, 'Cedar Loop', 'right', 'Turn right onto Cedar Loop; service the cluster boxes.', .36, 2, 18, [45.00145, -123.0005], ['Follow the loop back to Parkside Drive.']),
      item(5, 'Parkside Drive', 'left', 'Turn left onto Parkside Drive.', .24, 0, 0, [45.00145, -123.0005]),
      item(6, 'Market Street', 'left', 'Turn left onto Market Street.', .51, 0, 0, [44.9986, -123.0005]),
      item(7, 'Post Office parking lot', 'return', 'Turn into the Post Office parking lot.', .28, 0, 0, [44.9986, -123.00375]),
    ],
  };
}
