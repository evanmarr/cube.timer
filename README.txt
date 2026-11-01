Cube.Timer patched files

Files:
- index.html
- script.js

Setup:
1. Keep both files in the same folder.
2. Open index.html in a modern browser.
3. The 3D simulator uses Three.js from a CDN, so the first load requires internet access.

Changes in this package:
- Fixed the inspection / hold-to-ready / release-to-start keyboard flow.
- Added the missing personal-best confetti function.
- Added achievements calculated from the current solve history, so deleting a qualifying solve removes the corresponding achievement.
- Removed the Algorithm Trainer page and its script.
- Added 2x2 through 9x9 cube-size options and generalized the cubelet builder and layer selection for those sizes.
- Added custom-styled checkbox switches.
- Fixed a 3D layer-selection issue for even-sized cubes and kept layer transforms local to the cube group.

Known limitations:
- Pyraminx and Megaminx 3D models are not implemented in this package; the simulator currently supports NxN cubic puzzles from 2x2 to 9x9.
- Browser alert/confirm/prompt dialogs are still native browser dialogs; only the checkbox controls have custom styling.
- The 3D simulator requires WebGL and a network connection to load Three.js.
