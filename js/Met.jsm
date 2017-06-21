"use strict";

/** @module Met */
var EXPORTED_SYMBOLS = ['App', 'Weather'];

imports("Met.UI");
imports("Met.Weather");


var App = new Met.UI.App();
var Weather = Met.Weather.Service;
