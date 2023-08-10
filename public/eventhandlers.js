var submitBtn;
var useCustom;
var customWidth;
var customTop;
var customLeft;
var customSkew;
var blankUpload;
var logoUpload;
var logoSelect;
var productionMethod;

var blankTarget;
var logoTarget;
var imageContainer;
var imageRotate;

function init() {
	submitBtn = $('#file-uploads-submit');
	useCustom = $('#useCustom');
	customWidth = $('#customWidth');
	customTop = $('#customTop');
	customLeft = $('#customLeft');
	customSkew = $('#customSkew');
	blankUpload = $('#blankimg');
	logoUpload = $('#logoimg');
	logoSelect = $('#logoDropdown');
	productionMethod = $('#production');

	blankTarget = $('#blankitembackground');
	logoTarget = $('#newlogo');
	imageContainer = $('#imagecontainer');
	imageRotate = $('#imagerotate');

	addEventHandlers();
}

function addEventHandlers() {
	submitBtn.click(uploadLogos);
}

var uploadLogos = function() {

	let fd = new FormData();
	fd.append('blankimg', blankUpload[0].files[0]);
	fd.append('logoimg', logoUpload[0].files[0]);
	fd.append('useCustom', useCustom[0].checked);
	fd.append('customWidth', customWidth[0].value);
	fd.append('customTop', customTop[0].value);
	fd.append('customLeft', customLeft[0].value);
	fd.append('customSkew', customSkew[0].value);
	fd.append('logoSelect', logoSelect[0].value);
	fd.append('production', productionMethod[0].value);

	$.ajax({
		url: '/place-logo',
		type: 'post',
		data: fd,
		dataType: 'json',
		contentType: false,
		processData: false,
		success: function(res) {
			customWidth[0].value = res.width;
			customTop[0].value = res.top;
			customLeft[0].value = res.left;
			customSkew[0].value = res.rotation;

			blankTarget.attr('src', res.blankImgSrc);
			logoTarget.attr('src', res.logoImgSrc);
			imageRotate.attr('style', `width: ${res.width}px; top: ${res.top}%; left: ${res.left}%;`);
			logoTarget.attr('style', `transform: rotateY(${res.rotation}deg);`);
			console.log(res.itemClass);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			window.alert("Error with sending data :(");
		}
	});
}

init();
