import Papa from 'papaparse';

/**
 * Utility to parse EUC telemetry logs (CSV format)
 */
export const parseLogFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        resolve(processParsedData(results.data));
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

/**
 * Perform initial data cleanup and unit conversions if necessary
 */
const processParsedData = (data) => {
  if (!data || data.length === 0) return [];

  return data.map((row, index) => {
    // Ensure we have a consistent timestamp or index
    const timestamp = row.time ? row.time : index;
    
    // Calculate power if not explicit but V/I are present
    const power = row.power !== undefined ? row.power : (row.voltage * row.current);

    return {
      ...row,
      timestamp,
      calculatedPower: power
    };
  });
};

/**
 * Extract summary statistics from the log
 */
export const analyzeLog = (data) => {
  if (!data || data.length === 0) return null;

  const analysis = {
    maxSpeed: 0,
    maxPower: 0,
    maxPhaseCurrent: 0,
    minVoltage: Infinity,
    avgVoltage: 0,
    maxPWM: 0,
    maxTilt: 0,
    maxRoll: 0,
    totalDistance: 0,
    dataPoints: data.length
  };

  let sumVoltage = 0;

  data.forEach(row => {
    if (row.speed > analysis.maxSpeed) analysis.maxSpeed = row.speed;
    if (row.calculatedPower > analysis.maxPower) analysis.maxPower = row.calculatedPower;
    if (row.phase_current > analysis.maxPhaseCurrent) analysis.maxPhaseCurrent = row.phase_current;
    if (row.voltage < analysis.minVoltage) analysis.minVoltage = row.voltage;
    if (row.pwm > analysis.maxPWM) analysis.maxPWM = row.pwm;
    if (row.totaldistance > analysis.totalDistance) analysis.totalDistance = row.totaldistance;
    if (Math.abs(row.tilt) > analysis.maxTilt) analysis.maxTilt = Math.abs(row.tilt);
    if (Math.abs(row.roll) > analysis.maxRoll) analysis.maxRoll = Math.abs(row.roll);
    
    sumVoltage += row.voltage;
  });

  analysis.avgVoltage = sumVoltage / data.length;

  return analysis;
};
