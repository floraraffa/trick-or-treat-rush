// Dev only (specs.html?emulate on the dev server): a headset emulated in the browser with Meta's IWER, hands
// as the input, so the Specs version can be tried and tested without glasses. Never part of the build.
// The device is window.__xrDevice: tests move its hands and pinch (`hands.right.updatePinchValue(1)`).
import { XRDevice, metaQuest3 } from 'iwer';

const device = new XRDevice(metaQuest3);
device.installRuntime({ forceInstall: true }); // (over the browser's own runtime, which has no headset)
device.primaryInputMode = 'hand';
const q = new URLSearchParams(location.search);
device.stereoEnabled = q.get('emulate') === 'stereo';
if (q.has('fov')) device.fovy = (+q.get('fov') * Math.PI) / 180; // e.g. &fov=33: about the Specs' window (46° diagonal)
window.__xrDevice = device;
console.info('[specs] emulated headset (IWER): hands, immersive-ar');
