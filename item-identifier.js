
//==========Import Statements==============

const fs = require('fs');
const { Image } = require('image-js');
const path = require('path');

const convnet = require('convnetjs');

// Where prebuilt model is stored
const netJSON = require('./item-network.json');

// Configuration data for the model
const config = require('./config.json');



//================Constants===================

const itemClasses = config.itemClasses;



//===============Model Class===============

module.exports = class ItemIdentifier {

	//create model object
	constructor(usePrebuilt) {

		this.net = new convnet.Net();

		if (usePrebuilt) {
			this.net.fromJSON(netJSON);
			console.log('Done!');
		}
		else {
			let layerDefs = [];

			layerDefs.push({type:'input', out_sx:32, out_sy:32, out_depth:1});
			layerDefs.push({type:'conv', sx:5, filters:8, stride:1, pad:2, activation:'relu'});
			layerDefs.push({type:'pool', sx:2, stride:2});
			layerDefs.push({type:'conv', sx:5, filters:16, stride:1, pad:2, activation:'relu'});
			layerDefs.push({type:'pool', sx:2, stride:2});
			layerDefs.push({type:'conv', sx:5, filters:32, stride:1, pad:2, activation:'relu'});
			layerDefs.push({type:'pool', sx:2, stride:2});
			layerDefs.push({type:'softmax', num_classes:7});

			this.net.makeLayers(layerDefs);

			this.prepareNetwork().then (function(model) {
				console.log('Done!');
			});
		}

	}

	/**
	Begin the training process for the model
	*/
	async prepareNetwork() {
		let trainingData = await this.getTrainingData();
		console.log('Retreived training data');

		/*
		let testingData = await this.getTestingData();
		console.log('Retreived testing data');
		*/

		console.log('Starting training...');
		let trainer = new convnet.Trainer(this.net, {method: 'adadelta', l2_decay: 0.001, batch_size: 1});

		let x = new convnet.Vol(32, 32, 1, 0.0);
		let shape = 32 * 32;

		for (let j = 0; j < 10000; j++) {
			trainingData = trainingData.sort( (a, b) => 0.5 - Math.random() );

			let stats;
			for (let item of trainingData) {
				for (let i = 0; i < shape; i++) {
					x.w[i] = item.input[i];
				}
				stats = trainer.train(x, item.output);
			}
			if (j % 1000 == 0) {
				 console.log(`Iteration: ${j}`);
				 console.log(stats);
			}
		}

		console.log('Finished training\nStarting testing...');

		/*
		for (let item of testingData) {
			for (let i = 0; i < shape; i++) {
				x.w[i] = item.input[i];
			}
			let score = this.net.forward(x);
			console.log(`Expected: ${item.output}\nPredicted:`);
			console.log(score);
		}

		*/
		console.log('Finished testing\nSaving model...');

		let netJSON = this.net.toJSON();
		let netJsonStr = JSON.stringify(netJSON);
		fs.writeFileSync('./item-network.json', netJsonStr);
		console.log('Finished saving model to json file');

	}

	/**
	Forward pass of the model without backpropagation.

	Param - image: Image JS object

	Returns: The category the clothing image belongs to (string)
	*/
	activate(image) {
		let newImg = image.resize({width: 32, height: 32});
		let x = new convnet.Vol(32, 32, 1, 0.0);
		let shape = 32 * 32;
		
		for (let i = 0; i < shape; i++) {
			let pixel = newImg.getPixel(i);
			x.w[i] = (pixel[0] + pixel[1] + pixel[2]) / 765;
		}

		let score = this.net.forward(x);
		let results = score.w;

		let maxIndex = 0;
		for (let i = 1; i < results.length; i++) {
			if (results[i] > results[maxIndex]) {
				maxIndex = i;
			}
		}

		return itemClasses[maxIndex];
	}

	/**
	Retrieves the training data for the model. The training data is every subfolde 
	and image inside the 'training-items' folder.

	Returns: Input and Ouput objects. Input => Array<Number>. Output => Array<Number> (One-hot encoded)
	*/
	async getTrainingData() {
		let data = [];

		let trainingDirs = fs.readdirSync('./training-items');

		let index = 0;

		for (let itemDir of trainingDirs) {
			let itemNames = fs.readdirSync('./training-items/' + itemDir);
			for (let itemName of itemNames) {
				let outputData = index;

				let dataObj = {input: [], output: outputData};

				let image = await Image.load('./training-items/' + itemDir + '/' + itemName);
				image = image.resize({width: 32, height: 32});

				for (let pixel of image.getPixelsArray() ) {
					dataObj.input.push( (pixel[0] + pixel[1] + pixel[2]) / 765 );
				}

				data.push(dataObj);
			}

			index++;
		}

		return data;
	}

	/**
	=============Depricated=============
	*/
	async getTestingData() {
		let data = [];

		let testingDirs = fs.readdirSync('./testing-items');

		let index = 0;

		for (let itemDir of testingDirs) {
			let itemNames = fs.readdirSync('./testing-items/' + itemDir);
			for (let itemName of itemNames) {
				let outputData = index;

				let dataObj = {input: [], output: outputData};

				let image = await Image.load('./testing-items/' + itemDir + '/' + itemName);
				image = image.resize({width: 32, height: 32});

				for (let pixel of image.getPixelsArray() ) {
					dataObj.input.push( (pixel[0] + pixel[1] + pixel[2]) / 765 );
				}

				data.push(dataObj);
			}

			index++;
		
		}

		return data;
	}

}
