import { Espruino } from 'https://unpkg.com/ixfx/dist/io.js';

/** @type NormaliseData|undefined  */
let normaliseData;

// Channel to talk to plotter
const bc = new BroadcastChannel(`mag`);

/**
 * Initialise with function to normalise data
 * @param {NormaliseData} normaliseDataFunction  
 */
export function init(normaliseDataFunction) {
  normaliseData = normaliseDataFunction;
  onConnected(false);
}

/**
 * Called when connection state changes.
 * @param {boolean} connected 
 */
function onConnected(connected) {
  // Post connected status to plotter
  bc.postMessage({ connected });

  // Add some CSS classes to body depending on connection state
  if (connected) {
    document.body.classList.add(`espruino-connected`);
    document.body.classList.remove(`espruino-disconnected`);
  } else {
    document.body.classList.remove(`espruino-connected`);
    document.body.classList.add(`espruino-disconnected`);
  }

  // And also add/remove .hidden for elements that opt-in
  for (const el of document.querySelectorAll(`.hide-when-connected`)) {
    if (connected) {
      el.classList.add(`hidden`);
    } else {
      el.classList.remove(`hidden`);
    }
  }

  for (const el of document.querySelectorAll(`.show-when-connected`)) {
    if (connected) {
      el.classList.remove(`hidden`);
    } else {
      el.classList.add(`hidden`);
    }
  }
};

/**
 * Connect to Espruino
 * @param {string} script 
 * @param {string} deviceFilter
 */
export async function connect(script, deviceFilter) {
  try {
    // Filter by name, if defined in settings
    const options = deviceFilter.length > 0 ? { name: deviceFilter } : {};

    // Connect to Puck
    const p = await Espruino.puck(options);
    console.log(`Connected`);

    // Listen for state change event (for debugging)
    p.addEventListener(`change`, event => {
      console.log(`${event.priorState} -> ${event.newState}`);
    });

    // After a short delay...
    setTimeout(async () => {
      // Send the script
      await p.writeScript(script);

      // Set our state to connected
      onConnected(true);

      // Listen for incoming data
      p.addEventListener(`data`, onData);
    }, 1000);
  } catch (error) {
    console.error(error);
  }
};

/**
 * Data received from Espruino.
 * Need to parse JSON and pass through provided normalise function
 * @param {import('https://unpkg.com/ixfx/dist/io.js').IoDataEvent} event 
 * @returns 
 */
function onData(event) {
  const data = event.data.trim(); // Remove line breaks etc

  // If it doesn't look like JSON, exit
  if (!data.startsWith(`{`)) return;
  if (!data.endsWith(`}`)) return;

  // So far so good, try to parse as JSON
  try {
    const d = /** @type MagReading */(JSON.parse(data));

    // Normalise data
    const out = normaliseData ? normaliseData(d) : d;

    // Print out a warning if resulting data is out-of-range
    rangeWarning(d, out);

    // Send out data so plotter can use it
    bc.postMessage({ input: d, output: out });
  } catch (error) {
    console.warn(error);
  }
}

/**
 * Print a warning if scaled data doesn't seem quite right
 * @param {MagReading} inputData 
 * @param {MagReading} outputData 
 */
export function rangeWarning(inputData, outputData) {
  if (outputData.x < -1 || outputData.x > 1) console.warn(`x value out of range. Input: ${inputData.x} Output: ${outputData.x}`);
  if (outputData.y < -1 || outputData.y > 1) console.warn(`y value out of range. Input: ${inputData.y} Output: ${outputData.y}`);
  if (outputData.z < -1 || outputData.z > 1) console.warn(`z value out of range. Input: ${inputData.z} Output: ${outputData.z}`);
}

/**
 * @typedef {(data:MagReading)=>MagReading} NormaliseData 
 */

/**
 * @typedef {Readonly<{
 *  x: number
 *  y: number
 *  z: number
 * }>} MagReading
*/