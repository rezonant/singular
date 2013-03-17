$(document).ready(function() {
	window.LevelLabel = SingularView.extend({});
	$(document).singular();
	
	if ($('body').attr('data-show-inspector') == '1') {
		var inspector = sgInspect();
		if ($(document).width() > 977)
			inspector.show();
	}
	
	//  Set up the page system
	
	var loadPage = function(url) {
		$.ajax('.'+url, {
			dataType: 'text',
			type: 'GET',
			
			complete: function(xhr) {
				// Hack around dumbness in Jasmine's HTML reporter
				$('#HTMLReporter').hide();
				$('[data-role=content]').html(xhr.responseText).singular();
			},
			error: function(xhr) {
				alert('Error loading page '+url);
			},
		})
	};
	
	if (!window.location.hash) {
		window.location.hash = '/demo.html';
	} else {
		loadPage(window.location.hash.substr(1));
	}
	
	addEventListener("hashchange", function() {
		loadPage(window.location.hash.substr(1));
	}, false);
});
