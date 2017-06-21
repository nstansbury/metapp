'use strict';

/** @module Met.Weather */
var EXPORTED_SYMBOLS = ['Service'];


const APP_KEY = 'appid=920bfc447c692d05fd5ce6a4c7c164db';

const STATIC_URL = 'data.json?';
const DATA_URL = 'https://cors-anywhere.herokuapp.com/http://api.openweathermap.org/data/2.5/forecast?' +APP_KEY;


var Service = {
    __locations : {},
    __params : {},

    /** @param {string} location */
	/** @returns {Promise} */
    getForecast(location){
        var param = '';
        if(typeof location === 'String'){
            param = 'q=' +location +',gb&units=metric'
        }
        else if(location.latitude) {
            param = '&lat=' +location.latitude.toFixed(4) +'&lon=' +location.longitude.toFixed(4) +'&units=metric';
        }

        if(this.__params[param]) return this.__params[param];

        var self = this;
		return new Promise(function(resolve, reject){
			var httpRequest = new XMLHttpRequest();
			httpRequest.open("GET", DATA_URL +param);

			function onreadystatechange(){
				if(httpRequest.readyState == HttpRequestReadyState.DONE){
					var data = JSON.parse(httpRequest.response);
                    var forecast = new Forecast(data);
                    var location = forecast.location.toLowerCase().replace(/\s+/g, '');
                    self.__params[param] = self.__locations[location] = forecast;
					resolve(forecast);
				}
			}

			httpRequest.onreadystatechange = onreadystatechange;
			httpRequest.send();
		});
    },

    /** @param {string} location */
	/** @returns {Forecast} */
    getLocationForecast(location){
        return this.__locations[location] || null;
    }
}


/** @param {object} data */
function Forecast(data){
    this.__location = data.city.name;
    this.__days = [];
    for(var i = 0; i < data.list.length; i++) {
        var entry = new ForecastEntry(data.list[i]);
        var day = entry.datetime.getDay();
        if(this.__days[day] === undefined){
            this.__days[day] = [];
            this.__days[day].max_temp = 0;   //
        }
        this.__days[day].push(entry);
        this.__days[day].max_temp = entry.temperature > this.__days[day].max_temp ? entry.temperature : this.__days[day].max_temp;
    }
}
Forecast.prototype = {
    /** @returns {string} */
    get location(){return this.__location;},

    /** @returns {Array<ForecastEntry>} */
    get days(){return this.__days;},

    /** @returns {ForecastEntry} */
    getDay(day){return this.__days[day];}
}

/** @param {object} data */
function ForecastEntry(data){
    this.__data = data;
}
ForecastEntry.prototype = {
    /** @returns {Date} */
    get datetime(){return new Date(this.__data.dt_txt.replace(/-/g, "/"));},

    /** @returns {number} */
    get temperature(){return Math.floor(this.__data.main.temp);},

    /** @returns {number} */
    get type(){return this.__data.weather[0].id;},

    /** @returns {string} */
    get description(){return this.__data.weather[0].description;},

    /** @returns {number} */
    get cloud(){return this.__data.clouds.all;},

    /** @returns {number} */
    get wind(){return this.__data.wind.speed;}
}
