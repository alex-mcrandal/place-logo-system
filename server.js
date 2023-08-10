// =========Import Statements============

const express = require('express');
const path = require('path');
const fs = require('fs');
const formidable = require('formidable');
const { Image } = require('image-js');

const ItemIdentifier = require('./item-identifier');

const config = require('./config.json');

/**
Information for getting a certain logo for a specific company to appear in different colors.

Should be loaded and rearranged into Maps only once.
*/
var ureLogoInfo = require(path.join(__dirname, 'stores', 'ure', 'logos', 'ure', 'data.json'));
for (let key in ureLogoInfo) {
	ureLogoInfo[key] = new Map(Object.entries(ureLogoInfo[key]));
}



// =======Constants============


// Express setup
const app = express();
const port = 8080;


// ========Global Variables=========


// CNN model
var itemAI;

// Which company's store is active
var activeStore = path.join(__dirname, 'stores', 'ure');


// =========Express Setup=========

app.use(express.static('public'));
app.use(express.static('blank-imgs'));
app.use(express.static('logo-uploads'));


// ==========Helper Functions============

/**
Calculate the difference between two colors

Uses the mean error squared for the red, green, and blue of both colors

Returns: Error (float)
*/
function colorError(colorArray1, colorArray2) {
	let rError = Math.abs(colorArray1[0] - colorArray2[0]);
	let gError = Math.abs(colorArray1[1] - colorArray2[1]);
	let bError = Math.abs(colorArray1[2] - colorArray2[2]);

	return Math.pow( (rError + gError + bError) / 3, 2);
}

/**
Calculates the pixel width of a logo to be displayed in the browser

logoImgSrc: Name of the logo in the 'logo-uploads' folder
displaySize: How many pixels wide the actual logo should be (ignoring white/transparent background)

Approximates the actual width of the logo inside the shape of the image ignoring white/transparent background

Returns: Number of pixels wide the image should be displayed in the browser (float)
*/
async function calcApproxLogoWidth(logoImgSrc, displaySize) {

	let logoDir = path.join(__dirname, 'logo-uploads', logoImgSrc);
	let logoImg = (await Image.load(logoDir)).rgba8();
	let imgWidth = logoImg.width;
	//console.log(imgWidth);
	//console.log(displaySize);

	let increment = 20;
	let approxStart = logoImg.width - 1;
	for (let y = 0; y < logoImg.height; y = y + increment) {
		for (let x = 0; x < logoImg.width; x++) {
			let pixel = logoImg.getPixelXY(x, y);
			let greyValue = (pixel[0] + pixel[1] + pixel[2]) / 3;
			if ( (greyValue > 5 || pixel[3] > 200) && x < approxStart) {
				approxStart = x;
				break;
			}
		}
	}

	let approxEnd = 0;
	for (let y = 0; y < logoImg.height; y = y + increment) {
		for (let x = logoImg.width - 1; x > -1; x--) {
			let pixel = logoImg.getPixelXY(x, y);
			let greyValue = (pixel[0] + pixel[1] + pixel[2]) / 3;
			if ( (greyValue > 5 || pixel[3] > 200)&& x > approxEnd) {
				approxEnd = x;
				break;
			}
		}
	}

	let result =  displaySize * imgWidth / (approxEnd - approxStart);
	//console.log(`Display Size: ${displaySize}\tImg Width: ${imgWidth}\tEnd: ${approxEnd}\tStart: ${approxStart}`);
	//console.log(result);
	return result;
}



// ===========Web Requests============

/**
Get the home page
*/
app.get('/place-logo', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
Client has asked for all of the current logo names
*/
app.post('/query-logos', async (req, res) => {
	let logoNames = fs.readdirSync(path.join(activeStore, 'logos'));
	res.json({'names': logoNames});
});

/**
Client has asked to see logo on clothing item
*/
app.post('/place-logo', async (req, res) => {
	console.log('Received image post request...');

	// Filter for the POST form to ensure JPG and PNG files are sent to the server
	const options = {
		filter: function ({name, originalFilename, mimetype}) {
			return mimetype && (mimetype.includes('png') || mimetype.includes('jpeg') );
		}
	};

	// Parse the POST form to data fields and files (images)
	var form = new formidable.IncomingForm(options);
	form.parse(req, async function (err, fields, files) {
		if (err) throw err;

		//console.log(fields);



		let selectLogoDir = '';
		// Whether or not the client uploaded a logo
		// Client did not upload a logo so use desired logo
		if (fields.logoimg == 'undefined') {
			selectLogoDir = path.join(activeStore, 'logos', fields.logoSelect);
		}
		// Client did upload a logo and write it to memory
		else {
			let oldpath = files.logoimg.filepath;
			let newpath = path.join(__dirname, '/logo-uploads/', files.logoimg.originalFilename);
			fs.renameSync(oldpath, newpath);
		}


		
		// Write the blank clothing item image to memory
		let oldpath = files.blankimg.filepath;
		let newpath = path.join(__dirname, '/blank-imgs/', files.blankimg.originalFilename);
		fs.renameSync(oldpath, newpath);

		// Load clothing item into an Image object
		let image = await Image.load(newpath);

		// Determine what category of clothing is being looked at using the CNN
		let itemClass = itemAI.activate(image);



		// Response variables
		let width;
		let top;
		let left;
		let rotation;
		let backgroundColor;

		// Whether or not the client wants to use custom positioning
		// Client does want custom positioning
		if (fields.useCustom === 'true'){
			// The color of the clothing item the logo is being placed on
			backgroundColor = image.getPixelXY( Math.floor(image.width * Number(fields.customLeft) / 100), Math.floor(image.height * Number(fields.customTop) / 100) );

			top = Number(fields.customTop);
			left = Number(fields.customLeft);
			rotation = Number(fields.customSkew);
		}
		// Client does not want custom positioning and will use the positioning based of the category form the CNN's result
		else {
			backgroundColor = image.getPixelXY( Math.floor(image.width * config[itemClass].left / 100), Math.floor(image.height * config[itemClass].top / 100) );

			top = config[itemClass].top;
			left = config[itemClass].left;
			rotation = 0;
		}



		// Determine what image should be used as the logo
		let logoSrc;
		// Use the uploaded logo
		if (selectLogoDir == '') {
			logoSrc = files.logoimg.originalFilename;
		}
		// Use the active logo that is prefered for the color of the clothing item
		else {
			//console.log(ureLogoInfo[fields.production]);
			let bestColorKey = '';
			let bestColorError = 9999;
			for (const key of ureLogoInfo[fields.production].keys()) {
				//console.log(key);
				let colorKey = key.split(',');
				for (let i = 0; i < colorKey.length; i++) {
					colorKey[i] = Number(colorKey[i]);
				}

				let cError = colorError(backgroundColor, colorKey);
				if (cError < bestColorError) {
					bestColorKey = key;
					bestColorError = cError;
				}
			}
			//console.log(bestColorKey);
			//console.log(ureLogoInfo[fields.production].get(bestColorKey));
			logoSrc = ureLogoInfo[fields.production].get(bestColorKey);
		}



		// Calculate width of logo
		if (fields.useCustom === 'true') {
			width = Number(fields.customWidth);
		}
		else {
			if (selectLogoDir == '') {
				width = await calcApproxLogoWidth(files.logoimg.originalFilename, config[itemClass].width);
				//console.log(width);
			}
			else {
				width = await calcApproxLogoWidth(logoSrc, config[itemClass].width);
				//console.log(width);
			}
		}



		// Debug
		//console.log(`Width: ${width}\tTop: ${top}\tLeft: ${left}`);



		// Server response
		res.json({
			'blankImgSrc': files.blankimg.originalFilename, 
			'logoImgSrc': logoSrc, 
			'itemClass': itemClass,
			'width': width,
			'top': top,
			'left': left,
			'rotation': rotation,
			'backgroundColor': backgroundColor
		});
	});
});


// ============ Start App =============


app.listen(port, () => {
	console.log('Creating item AI...');

	// Constructs the CNN model by either using a stored model in a JSON file (true), or creates and trains a new model (false)
	itemAI = new ItemIdentifier(config.useJSONModel);

	console.log('Finished creating AI');
	console.log(`Web app (http) listening on port ${port}`);
});
