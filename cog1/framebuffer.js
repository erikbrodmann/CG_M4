/**
 * Framebuffer is used buffer the rendering output and to draw to the canvas.
 * Z-Buffer is included in this module.
 *
 * For pixel manipulation in imageData see:
 * http://jsperf.com/canvas-pixel-manipulation
 * http://www.javascripture.com/Float32Array
 *
 * @namespace cog1
 * @module framebuffer
 */
define(["exports", "scene"], function(exports, scene) {
    "use strict";

	// Drawing context for canvas.
	let ctx;
	// Width and Height of the ctx for fast access.
	let width;
	let height;

	// We remember the size of the buffers for speedup.
	// Bytes (assuming one byte per channel) in a frame.
	let bufSize;
	let zBufSize;

	// Framebuffer as ImageData with size of canvas * 4 (rgba).
	// Thus we use a 1D buffer as storage.
	// We assume that the dimension of the canvas pixel match the CSS pixel.
	let imageData;
	// The data reference of the buffer (imageData.data).
	let framebuffer;

	// Z-Buffer, with size number of pixels.
	// Stores z-coordinate as floats.
	// Internal variable,  for z-buffer.
	//  Float 32 bit View on zBuffer (with ArrayBuffer).
	let zBuf;

	let resetBuffer32;
	let resetZBuffer;

	const maxDistance = -10000;

	const bgColor = [255, 255, 255, 255];

	let dirtyRect = {
		x : undefined,
		y : undefined,
		xMax : undefined,
		yMax : undefined,
		width : undefined,
		height : undefined
	};

	/**
	 * @parameter _ctx is a 2D context of the canvas.
	 * @parameter _bgColor is an rgb array.
	 */
	function init(_ctx, _bgColor) {
		ctx = _ctx;
		width = ctx.width;
		height = ctx.height;
		bufSize = width * height * 4;

		if(_bgColor !== undefined) {
			for(let i = 0; i < _bgColor.length; i++)
			{
				bgColor[i] = Number(_bgColor[i]);
			}
			bgColor[3] = 255;
		}

		imageData = ctx.getImageData(0, 0, width, height);
		framebuffer = imageData.data;
		if((width !== imageData.width) || (height !== imageData.height)) {
			console.log("WARNING: Dimension of the canvas pixel match the CSS pixel.");
		}
		// Initialize the zBuffer.
		zBufSize = width * height;
		zBuf = new Float32Array(zBufSize);

		initResetBuffer();

		// Reset to initialize framebuffer and z-buffer.
		setMaxDirtyRect();
		reset();
	}

	function initResetBuffer() {
		let r = bgColor[0];
		let g = bgColor[1];
		let b = bgColor[2];
		let a = bgColor[3];
		let bgcolor = (a << 24) | (b << 16) | (g << 8) | r;
		resetBuffer32 = new Uint32Array(bufSize/4);

		// Initialize color of the reset buffer to bgColor.
		let nEndIndex = bufSize / 4;
		for(let i = 0; i < nEndIndex; ++i) {
			resetBuffer32[i] = bgcolor;
		}
		resetZBuffer = new Float32Array(zBufSize);
		for(let i = 0; i < zBufSize; i++) {
			resetZBuffer[i] = maxDistance;
		}
	}

	/**
	 * Perform zBuffer test.
	 * @parameter color is an object-array with rgba values
	 * @return true on pass.
	 */
	function zBufferTest(x, y, z, color) {

		let indexZBuf = y * width + x;

		if (zBuf[indexZBuf] === undefined) {
			zBuf[indexZBuf] = z;
			return true;
		}
		if (zBuf[indexZBuf] < z + 10)
		{
			zBuf[indexZBuf] = z;
			return true;
		}
		return false;
	}

	/**
	 * Set a pixel/fragment in the frame-buffer and in z-buffer.
	 * Check range should be done in raster.
	 * On scan-line z-buffer test and dirty rectangle adjust my be skipped.
	 *
	 * @parameter color is an object with colorname : rgba values
	 * @parameter  doZBufferTest is done per default if not given.
	 * @parameter adjustDirtyRect is done per default if not given.
	 */
	function set(x, y, z, color, doZBufferTest, adjustDirtyRect) {

		if(x < 0 || y < 0 || x >= width || y >= height) return;


		if(doZBufferTest === undefined || doZBufferTest === true) {
			// Perform zBuffer-test (default).
			if(!zBufferTest(x, y, z, color)) {
				return;
			}
		}

		if(adjustDirtyRect === undefined || adjustDirtyRect === true) {
			adjustDirtyRectangle(x, y);
		}

		let rgba = color.rgbaShaded;
		let index = (y * width + x) * 4;
		framebuffer[index] = rgba[0]; // red
		framebuffer[++index] = rgba[1]; // green
		framebuffer[++index] = rgba[2]; // blue
		framebuffer[++index] = rgba[3]; // alpha
	}

    /**
     * Set to the min values.
     * Canvas coordinates range [0,width|height-1].
     */
    function resetDirtyRect() {
        dirtyRect.x = width - 1;
        dirtyRect.y = height - 1;
        dirtyRect.xMax = 0;
        dirtyRect.yMax = 0;
    }

    /**
     * Set to the max values. Used for initial reset.
     */
    function setMaxDirtyRect() {
        dirtyRect.x = 0;
        dirtyRect.y = 0;
        dirtyRect.xMax = width - 1;
        dirtyRect.yMax = height - 1;
    }

	/**
	 * Adjust the dirty rectangle adding a point.
	 * Check of correct the range must be done before.
	 */
	function adjustDirtyRectangle(x, y) {
		if(x < dirtyRect.x) {
			dirtyRect.x = x;
		} else if(x > dirtyRect.xMax) {
			dirtyRect.xMax = x;
		}
		if(y < dirtyRect.y) {
			dirtyRect.y = y;
		} else if(y > dirtyRect.yMax) {
			dirtyRect.yMax = y;
		}
	}

	/**
	 * Reset framebuffer and z-buffer.
	 * Called before every frame or to clear.
	 * Values are reset by copying buffers.
	 *  @returns clearect object, i.e., the last dirty rect to be cleared in scene. 
	 *  or null if nothing is to be cleared.
	 */
	function reset() {

		let dirtyStartIndex = dirtyRect.y * width + dirtyRect.x;
		let dirtyEndIndex = dirtyRect.yMax * width + dirtyRect.xMax;
		let dirtyWidth;
		let dirtyData, dirtyDataReset;
		// Return null if nothing is to be cleared on the canvas.
		var clearrect = null;


		// Check if there was anything drawn. 
		if(dirtyEndIndex > dirtyStartIndex) {
			// Dirty width in 4 bytes.
			dirtyWidth = dirtyEndIndex - dirtyStartIndex;

			dirtyStartIndex *= 4;
			dirtyData = new Float32Array(zBuf.buffer, dirtyStartIndex, dirtyWidth);
			dirtyDataReset = new Float32Array(resetZBuffer.buffer, 0, dirtyWidth);
			dirtyData.set(dirtyDataReset);

			dirtyEndIndex = dirtyEndIndex * 4;
			dirtyWidth = dirtyEndIndex - dirtyStartIndex;

			dirtyData = new Uint8ClampedArray(framebuffer.buffer, dirtyStartIndex, dirtyWidth);
			dirtyDataReset = new Uint8ClampedArray(resetBuffer32.buffer, 0, dirtyWidth);
			dirtyData.set(dirtyDataReset);

            var clearRect = {
                x : dirtyRect.x,
                y : dirtyRect.y,
                w : dirtyRect.xMax - dirtyRect.x + 1,
                h : dirtyRect.yMax - dirtyRect.y + 1               
            }; 
        }

		resetDirtyRect();
		
		return clearRect
	}

	/**
	 * Copy the buffer onto the canvas.
	 */
	function display() {

		if(scene.getDebug_zBuffer())
		{
			MultiplyFramebufferWithZBuffer(true);
		}

		dirtyRect.width = dirtyRect.xMax - dirtyRect.x;
		dirtyRect.height = dirtyRect.yMax - dirtyRect.y;
		if(dirtyRect.width < 0 || dirtyRect.height < 0) {
			return;
		} else {
			dirtyRect.width++;
			dirtyRect.height++;
		}
		ctx.putImageData(imageData, 0, 0, dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
	}

	/**
	 * Scale the z-buffer for visualization to interval [0,1].
	 */
	function scaleZBuffer() {
		// Initialize z-min and z-max (maxDistance is large negative)
		// reversed, complementary and scale linearly.
		let min = -maxDistance;
		let max = maxDistance;
		// Get min and max.
		for(let i = 0; i < zBufSize; i++)
		{
			if(zBuf[i] === maxDistance)
				continue;
			if(zBuf[i] > max)
			{
				max = zBuf[i];
			} else if(zBuf[i] < min) {
				min = zBuf[i];
			}
		}
		let range = Math.abs(max - min);
		if(range === 0)
			range = 1;
		for(let i = 0; i < zBufSize; i++)
		{
			if(zBuf[i] === maxDistance) {
				continue;
			}
			zBuf[i] = (zBuf[i] - min) / range;
		}
	}

	/**
	 * Multiply the z-buffer for visualization to interval [0,1].
	 */
	function MultiplyFramebufferWithZBuffer(greyOnly) {

		scaleZBuffer();

		let dirtyStartIndex = dirtyRect.y * width + dirtyRect.x;
		let dirtyEndIndex = dirtyRect.yMax * width + dirtyRect.xMax;

		for(let i = dirtyStartIndex; i < dirtyEndIndex; i++) {
			let z = zBuf[i];
			let j = i * 4;

			if(z !== maxDistance) {
				z = 1 - z;
				if(greyOnly) {
					z *= 255.0;
					framebuffer[j] = z;
					framebuffer[j + 1] = z;
					framebuffer[j + 2] = z;
				} else {
					framebuffer[j] *= z;
					framebuffer[j + 1] *= z;
					framebuffer[j + 2] *= z;
				}
			}
		}
	}

	// Public API.
	exports.init = init;
	exports.set = set;
	exports.zBufferTest = zBufferTest;
	exports.adjustDirtyRectangle = adjustDirtyRectangle;
	exports.reset = reset;
	exports.display = display;
	// Constants.
	exports.maxDistance = maxDistance;
});
