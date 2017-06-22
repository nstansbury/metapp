'use strict';

/** @module Met.UI */
var EXPORTED_SYMBOLS = ['App'];


function App(){
    this.__mainView = new AppMain();

    var location = document.location.pathname;
	window.history.pushState({identifier : location}, location, location);

	var self = this;
	window.onpopstate = function(event){
		if(event.state){
			self.navigateTo(event.state.identifier);
		}
		else {
			self.navigateTo('/');
		}
	};
}

App.prototype = {
    __views : {},

    /** @returns {void} */
    load(){
        return Promise.all([Promise.resolve()]);
    },

    /** @param {string} dest */
	/** @returns {void} */
	navigateTo(dest){
		dest = dest.toLowerCase().replace(/\s+/g, '');
        console.log('navigateTo', dest);
		if(dest != document.location.pathname){
			window.history.pushState({identifier : dest}, dest, dest);
		}

		if(this.__views[dest]){
			this.appView = this.__views[dest];
			return;
		}

		var path = dest.split('/');
        var view = path[1] !== '' ? new ForecastView(path) : new HomeView();
        this.addView(view, dest);
        this.appView = view;
	},

    /** @param {ApplicationView} view */
    /** @param {String} url */
	/** @returns {void} */
	addView(view, url){
		this.__mainView.appendChild(view);
		this.__views[url] = view;
	},

    /** @returns {ApplicationView} */
	get lastAppView(){
		return this.__lastAppView;
	},

	/** @returns {ApplicationView} */
	get appView(){
		if(!this.__appView){
			this.navigateTo(document.location.pathname);
		}
		return this.__appView;
	},

	/** @param {ApplicationView} appview */
	set appView(appview){
		this.__lastAppView = this.__appView;
		this.__appView = appview;

		if(this.__lastAppView){
			this.__lastAppView.setAttribute('hidden', true);
		}
		if(this.__appView){
			this.__appView.setAttribute('hidden', false);
		}
	}

}

var ApplicationView = {
	__proto__ : UI.Component.prototype
    // Title, URL etc
}


function AppMain(){
	UI.Component.call(this, 'cx-appmain');
	document.body.appendChild(this.hostElement);
}
AppMain.prototype = {
	__proto__ : ApplicationView
}

function HomeView(){
	UI.Component.call(this, 'cx-homeview');
}
HomeView.prototype = {
	__proto__ : ApplicationView,

    commands : ["cmdgeolocate"],

    /** @returns {Boolean} */
	oncmdgeolocate(){
        var self = this;
        var location = this.hostElement.querySelector('#location');
        var geolocate = this.hostElement.querySelector('[data-command="cmdgeolocate"]');

        location.setAttribute('disabled','true');
        geolocate.setAttribute('disabled','true');
        geolocate.setAttribute('data-state','busy');
        var defaultText = geolocate.textContent;
        geolocate.textContent = 'Waiting for data..';

        function onsuccess(position){
            if(position){
                Met.Weather.getForecast(position.coords).then(
                    function(forecast){
                        Met.App.navigateTo('/' +forecast.location);
                        location.removeAttribute('disabled');
                        geolocate.removeAttribute('disabled');
                        geolocate.removeAttribute('data-state');
                        geolocate.textContent = defaultText;
                    },
                    onerror
                );
			}
            else {
                onerror();
            }

        }
        function onerror(e){
            console.error('Geolocation Error', e);
            location.removeAttribute('disabled');
            geolocate.setAttribute('data-state','error');
            geolocate.textContent = 'Location not available';
        }
		navigator.geolocation.getCurrentPosition(onsuccess, onerror);
	}
}

function ForecastView(path){
	UI.Component.call(this, 'cx-forecastview');

    var forecast = Met.Weather.getLocationForecast(path[1]);

    this.__forecast = new UIForecast(forecast);
    this.__forecastlist = new UIForecastList(forecast);

    this.appendChild(this.__forecast);
    this.appendChild(this.__forecastlist);
    this.select(getDayOfWeek(path[2] || 'today'));
}
ForecastView.prototype = {
	__proto__ : ApplicationView,

    __appmenu : '',

    events : ['click'],

    commands : ['cmdsettings','cmdlocations'],

    /** @returns {Boolean} */
    onclick(event){
        this.toggleMenu('');
    },

    /** @returns {Boolean} */
    oncmdsettings() {
        this.toggleMenu('settings');
    },

    /** @returns {Boolean} */
    oncmdlocations() {
        this.toggleMenu('locations');
    },

    /** @param {string} name */
    /** @returns {void} */
    toggleMenu(name){
        this.__appmenu === name ? this.__appmenu = '' : this.__appmenu = name;
        var button = this.hostElement.querySelector('button[type="menu"][aria-pressed="true"]');
        if(button) button.setAttribute('aria-pressed', 'false');
        this.hostElement.querySelector('#app-navbar').setAttribute('data-menu', this.__appmenu);
    },

    /** @param {number} day */
    /** @returns {void} */
    select(day){
        day = this.__forecast.select(day);
        this.__forecastlist.select(day);
    }
}


function UIForecast(forecast){
    UI.Component.call(this, 'cx-forecast');
    this.__forecast = forecast;
    //this.__forecastlist = new UIForecastList(forecast);
    //this.__forecastlist.setAttribute('data-dir','column');
    //this.appendChild(this.__forecastlist);
}
UIForecast.prototype = {
    __proto__ : UI.Component.prototype,

    /** @param {number} day */
    /** @returns {number} */
    select(day){
        var dayforecast = this.__forecast.getDay(day);
        if(!dayforecast) dayforecast = this.__forecast.getDay(day += 1); // Doesn't return previous 3 hours of day
        var dayname = getDayOfWeek(day);
        this.setAttribute('data-forecast-weather', dayforecast[0].type);
        this.hostElement.querySelector('#app-forecast-date').textContent = dayname;
        this.hostElement.querySelector('#app-forecast-location').textContent = this.__forecast.location;
        this.hostElement.querySelector('#temp-day-high').textContent = dayforecast.max_temp;
        this.hostElement.querySelector('#app-forecast-cloudtype').textContent = dayforecast[0].description;
        this.hostElement.querySelector('#app-forecast-windtype').textContent = '';
        return day;
    }
}

/** @param {Forecast} forecast */
function UIForecastList(forecast){
    UI.Component.call(this, 'cx-forecast-list');
    this.__forecast = forecast;
    var days = [...forecast.days];
    var today = new Date().getDay();
    for(var i = today; i < days.length; i++){
        if(days[i] !== undefined) this.appendChild(new UIForecastItem(days[i][0], days[i].max_temp));
    }
    if(today > 0) {
        for(var i = 0; i < today; i++){
            if(days[i]) this.appendChild(new UIForecastItem(days[i][0], days[i].max_temp));
        }
    }
}
UIForecastList.prototype = {
    __proto__ : UI.Component.prototype,

    /** @param {number} day */
    /** @returns {void} */
    select(day){
        if(this.__selected){
            this.hostElement.querySelector(['[data-day="' +this.__selected +'"]']).removeAttribute('data-selected');
        }
        this.hostElement.querySelector(['[data-day="' +day +'"]']).setAttribute('data-selected', 'true');
        this.__selected = day;
    }
}

/** @param {ForecastEntry} entry */
/** @param {number} max_temp */
function UIForecastItem(entry, max_temp){
    UI.Component.call(this, 'cx-forecast-item');
    this.setAttribute('data-forecast-weather', entry.type);
    this.setAttribute('data-day', entry.datetime.getDay());
    this.hostElement.querySelector('[data-anonid="title"]').textContent = getDayOfWeek(entry.datetime.getDay());
    this.hostElement.querySelector('[data-anonid="temperature"]').textContent = max_temp;
}
UIForecastItem.prototype = {
    __proto__ : UI.Component.prototype,

    commands : ['cmdselect'],

    /** @returns {Boolean} */
    oncmdselect(){
        Met.App.appView.select(parseInt(this.getAttribute('data-day')));
    }
}

var DayNames = {
    'sunday' : 0,
    'monday' : 1,
    'tuesday' : 2,
    'wednesday' : 3,
    'thursday' : 4,
    'friday' : 5,
    'saturday' : 6
}

var DaysOfWeek = {
    0 : 'Sunday',
    1 : 'Monday',
    2 : 'Tuesday',
    3 : 'Wednesday',
    4 : 'Thursday',
    5 : 'Friday',
    6 : 'Saturday'
}

/** @param {number|string} day */
/** @returns {number|string} */
function getDayOfWeek(day){
    var today = new Date().getDay();
    if(typeof day === 'string'){
        if(day === 'today'){
            return today;
        }
        else if(day === 'tomorrow'){
            return today +1;
        }
        else {
            return DayNames[day] || today;
        }
    }
    else {
        if(day === today) {
            return 'Today';
        }
        else if(day === today +1) {
            return 'Tomorrow';
        }
        else {
            return DaysOfWeek[day] || 'Today';
        }
    }
}
