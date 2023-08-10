var dropdown;

function init() {
	dropdown = $('#logoDropdown');

	addLogoNames();
}

function addLogoNames() {
	$.ajax({
		url: '/query-logos',
		type: 'post',
		data: '',
		dataType: 'json',
		contentYpe: false,
		processData: false,
		success: function(res) {
			for (let name of res.names) {
				dropdown.append(`<option value="${name}">${name}</option>`);
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			window.alert('Error with sending data :(');
		}
	});
}

init();
