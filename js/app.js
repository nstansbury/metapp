/** @description Met App Weather App Demo */
/** @author Neil Stansbury <neil@neilstansbury.com> */

'use strict';

var MetApp = {

	load : function(){
		var head = document.getElementsByTagName('HEAD')[0];
	    var script = document.createElement('SCRIPT');
	    script.type = 'text/javascript';
	    script.src = 'js/lib/jam.js';
	    script.onload = MetApp.startup;
	    head.appendChild(script);
	},

	startup : function(){
        Jam.preventCache = true;
        Jam.defaultPath = "js/";
        var onexec = Jam.getGroupCallback(MetApp.ready, 2);
		//Jam.exec('prefixfree.min.js', 'js/lib/', onexec);

		function loadComponents(){
			UI.importTemplate('components/templates.html', onexec);
            Jam.imports("Met", onexec);
		}
		Jam.exec('wx.js', 'js/lib/', loadComponents);

	},

	ready : function(){
        Met.App.load().then(function(){
            console.log('MetApp Is Ready');
            Met.App.navigateTo(document.location.pathname);
        }, function(e){console.log('MetApp Load Failed:', e)})

	}
}

document.addEventListener('DOMContentLoaded', MetApp.load, false);
