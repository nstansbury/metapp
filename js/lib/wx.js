"use strict";
/** @file wx.js */
/** @version 1.0.0 */
/** @description Web Components style custom elements */
/** @author Neil Stansbury <neil@neilstansbury.com> */

var componentDoc = null;


var HttpRequestReadyState = {
    UNSENT : 0,
    OPENED : 1,
    HEADERS_RECEIVED : 2,
    LOADING : 3,
    DONE : 4
}

/** @exports */
/** @param {string} url */
/** @param {function(Document)} [onloaded] */
/** @returns {void} */
function importTemplate(url, onloaded){
    function onreadystatechange(){
        if(httpRequest.readyState == HttpRequestReadyState.DONE){
            if(httpRequest.status != 200){
                throw new Error("WX :: Template Request Failed");
            }

            if(!xhr2 || httpRequest.response == null)   {
                componentDoc = document.implementation.createHTMLDocument("");
                componentDoc.documentElement.innerHTML = httpRequest.responseText;
            }
            else {
                componentDoc = httpRequest.response;
            }

            console.info("WX :: UI Component Template Loaded: " +url);
            if(onloaded){
                onloaded(url);
            }
        }
    }

    var httpRequest = new XMLHttpRequest();
    httpRequest.open("GET", url);

    try {
        //httpRequest.responseType = "document";
        var xhr2 = window.XMLHttpRequest && httpRequest.upload != undefined ? true : false;
        if(xhr2){
            httpRequest.responseType = "document";
        }
    }
    catch(e){
        var xhr2 = false;
    }
    //console.info("WX :: XMLHttpRequest Level 2 is " + (xhr2 ? "Enabled" : "Disabled"));
    httpRequest.onreadystatechange = onreadystatechange;
    httpRequest.send();
}


/** @exports */
/** @param {string} id */
/** @param {object} [params] */
/** @returns {DocumentFragment} */
function getTemplateFragment(id, params)    {
    var template = componentDoc.getElementById(id);
    if(!template){
        throw new Error("WX :: Template Not Defined: " +id);
    }
    if(template.content != undefined){
        return template.content.cloneNode(true);
    }
    else {
        var frag = document.createDocumentFragment();
        var len = template.childNodes.length;
        for(var i = 0; i < len; i++){
            frag.appendChild(template.childNodes[i].cloneNode(true));   // iOS throws if we try and cloneNode on the fragment
        }
        return frag;
    }

    // Iterate over the object keys replacing the template variables with the key values
    for(var key in params)  {
        var re = new RegExp("{" +key +"}", "g");
        template = template.replace(re, params[ key ]);
    }
    return template;
}


/** @param {NodeList} nodeList */
/** @returns {NodeList} */
function NodeListProxy(nodeList){
    if(typeof Proxy !== "undefined"){
        return new Proxy(nodeList, {
                get : function(target, property){
                    return Component.get(target[property]);
                }
            }
        )
    }
    else {
        var arr = [];
        arr.item = function(i){
            return this[i];
        }
        for(var i = 0; i < nodeList.length; i++){
            arr.push(Component.get(nodeList[i]));
        }
        return arr;
    }
}




/** @exports */
/** @constructor */
/** @description Abstract command to do 'this' on 'that'. Handler is 'this', Target is 'that' */
/** @param {string} name */
/** @param {Function} handler */
/** @param {Component} target */
function Command(name, handler, target){
    this.__name = name;
    this.__handler = handler || function(){console.error("WX :: No command handler defined for: " +name); return false;};
    this.__target = target;
    this.__enabled = true;
}
Command.prototype = {
    /** @returns {string} */
    get name(){
        return this.__name
    },

    /** @returns {boolean} */
    get enabled(){
        return this.__enabled;
    },

    /** @param {boolean} state */
    set enabled(state){
        var elem = this.__target.hostElement.querySelector("[data-command=" +this.__name +"]");
        if(elem && state == false){
            elem.setAttribute("disabled", "true");
        }
        else if(elem){
            elem.removeAttribute("disabled");
        }
        this.__enabled = state;
    },

    /** @returns {boolean} */
    execute : function(){
        return this.__handler.call(this.__target);
    },

    /** @returns {Promise} */
    executeAsync : function(){
        var self = this;
        return new Promise(function(resolve, reject){
            try {
                self.execute();
                resolve();
            }
            catch(e){
                reject(e);
            }
        });
    }
}


/** @exports */
/** @param {Component} target */
function CommandController(target){
    this.__commands = {};

    // Create concrete commands that this target implements
    var cmd = target.commands.length;
    while(cmd--){
        var name = target.commands[cmd];
        this.__commands[name] = new Command(name, target["on" +name], target);
    }
}
CommandController.prototype = {

    /** @param {string} cmd */
    /** @returns {Command} */
    getCommand : function(cmd){
        return this.__commands[cmd];
    },

    /** @param {string} cmd */
    /** @returns {boolean} */
    supportsCommand : function(cmd){
        return this.getCommand(cmd) == undefined ? false : true;
    },

    /** @param {string} cmd */
    /** @returns {boolean} */
    isCommandEnabled : function(cmd){
        return this.getCommand(cmd).enabled;
    },

    /** @param {string} cmd */
    /** @returns {boolean} */
    execCommand : function(cmd){
        return this.getCommand(cmd).execute();
    },

    /** @param {string} cmd */
    /** @param {Function} callback */
    /** @returns {boolean} */
    execCommandAsync : function(cmd, callback){
        this.getCommand(cmd).executeAsync(callback);
    }
}



/** @param {Component} component */
/** @param {string} type */
/** @returns {boolean} */
function isEventSupported(component, type) {
    var element = component.hostElement;
    type = "on" + type;
    if(type in element){
        return true;
    }
    else {
        element.setAttribute(type, "return;");
        return typeof element[type] == "function" ? true : false;
    }
}


/** @constructor */
function ComponentEventTarget(){
    this.__hostElement = document.createDocumentFragment();
}
ComponentEventTarget.prototype = {
    /** @returns {HTMLElement} */
    get hostElement() {
        return this.__hostElement;
    },

    /** @param {string} type */
    /** @param {function} listener */
    /** @param {boolean} [useCapture] */
    /** @returns {void} */
    addEventListener : function(type, listener, useCapture){
        this.hostElement.addEventListener(type, listener, useCapture);
    },

    /** @param {string} type */
    /** @param {function} listener */
    /** @param {boolean} [useCapture] */
    /** @returns {void} */
    removeEventListener : function(type, listener, useCapture){
        this.hostElement.removeEventListener(type, listener, useCapture);
    },

    /** @param {Event} event */
    /** @returns {void} */
    dispatchEvent : function(event){
        this.hostElement.dispatchEvent(event);
    }
}



/** @exports */
/** @param {DOMString|HTMLElement} template */
/** @param {object} [params] */
/** @constructor */
function Component(template, params){
    if(this instanceof Component === false){
        throw "WX :: The '" +template +"' component constructor must be an 'instanceOf' a Component";
    }

    if(typeof template == "string"){
        this.__hostElement = getTemplateFragment(template, params).querySelector("*");      // firstElementChild not well supported
    }
    else {  // Else we're turning an existing element into a component
        this.__hostElement = template;
        template = template.id || "component";
    }

    this.__hostElement.setAttribute("data-component", template);
    this.__content = this.__hostElement.querySelector("content");
    if(!this.__content){
        this.__content = this.__hostElement.appendChild(document.createElement("content"));
    }

    // Root Component Element
    Component.set(this, this.__hostElement);
    // Content Component Element for parentNode/parentElement
    Component.set(this, this.__content.parentElement);


    // Here we need to parse the template[attributes] collection to create DOM accessors

    this.__commandController = new CommandController(this);

    /********************* Event Handlers **********************/
    var component = this;

    function eventHandler(event){
        /*  Event/Command handling rules:
            1)  If the event is "click" try to dispatch a command
            2)  Else If the component implements that event type handler - dispatch it
        */

        if(event.type == "click" && component.dispatchCommand(event)){
            //console.log("dispatchCommand");
            return;
        }
        else if(component["on" +event.type] != undefined){
            //console.log("dispatchEvent");
            component["on" +event.type](event);
        }
    }

    var next = this.events.length;
    while(next--){
        var event = this.events[next];
        this.__hostElement.addEventListener(event, eventHandler, false);
    }

    /********************* Custom Event Handlers **********************/
    function customHandler(type){
        return function(event){
            component[type](event);
        }
    }

    if(this.commands.length > 0 && this.events.indexOf("click") == -1){
        // The 'click' event is the default command dispatcher if there isn't a 'click' event handler
        this.__hostElement.addEventListener("click", customHandler("dispatchCommand"), false);
    }

    if(this.events.indexOf("mouseenter") != -1){
        if(!isEventSupported(this,"mouseenter")){
            this.__hostElement.addEventListener("mouseover", customHandler("__onmouseenter"), false);
            this.__hostElement.addEventListener("mouseout", customHandler("__onmouseenter"), false);
        }
    }

    /********************** Ready Handler *********************/
    function onready(){
        if(document.body.contains(component.hostElement)) {
            clearInterval(timer);
            component.onready();
        }
    }

    if(this.onready){
        var timer = setInterval(onready, 0);
    }

}
Component.prototype = {
    __proto__ : ComponentEventTarget.prototype,

    __hostElement : null,
    __content : null,
    __commandController : null,

    /** @returns {HTMLElement} */
    get hostElement() {
        return this.__hostElement;
    },

    // Native DOM Interfaces
    /** @returns {HTMLElement} */
    get title() {
        return this.__hostElement.title;
    },

    set title(value) {
        this.__hostElement.title = value;
    },

    /** @returns {Node} */
    get parentNode(){
        return Component.get(this.hostElement.parentNode);
    },

    /** @returns {HTMLElement} */
    get parentElement(){
        return Component.get(this.hostElement.parentElement);
    },

    /** @returns {Node} */
    get nextSibling(){
        return Component.get(this.hostElement.nextSibling);
    },

    /** @returns {Node} */
    get previousSibling(){
        return Component.get(this.hostElement.previousSibling);
    },

    /** @returns {Node} */
    get firstChild(){
        return Component.get(this.__content.parentElement.firstChild);
    },

    /** @returns {Node} */
    get lastChild(){
        return Component.get(this.__content.previousSibling);
    },

    /** @returns {boolean} */
    get hasChildNodes(){
        return this.__content.hasChildNodes;
    },

    /** @returns {NodeList} */
    get childNodes(){
        return NodeListProxy(this.__content.parentElement.childNodes);
    },

    /** @returns {string} */
    get innerHTML(){
        return this.__content.innerHTML;
    },

    /** @param {string} value */
    /** @returns {void} */
    set innerHTML(value){
        this.__content.innerHTML = value;
    },

    get outerHTML(){
        return this.hostElement.outerHTML;
    },

    set outerHTML(htmlString){
        console.error("WX :: Ignoring request to set outerHTML")
    },

    /** @returns {DOMString} */
    get textContent(){

    },

    /** @param {DOMString} value */
    /** @returns {void} */
    set textContent(htmlString){

    },

    /** @returns {void} */
    focus : function(){
        this.hostElement.focus();
    },

    /** @returns {void} */
    blur : function(){
        this.hostElement.blur();
    },

    /** @param {Node} newChild */
    /** @returns {Node} */
    appendChild : function(newChild){
        if(newChild instanceof Component){
            newChild = newChild.hostElement
        }
        this.__content.parentNode.insertBefore(newChild, this.__content);
        return newChild;
    },

    /** @param {Node} oldChild */
    /** @returns {Node} */
    removeChild : function(oldChild){
        if(oldChild instanceof Component){
            oldChild = oldChild.hostElement;
        }
        this.__content.parentNode.removeChild(oldChild);
        return oldChild;
    },

    /** @param {Node} newChild */
    /** @param {Node} refChild */
    /** @returns {Node} */
    insertBefore : function(newChild, refChild){
        if(newChild instanceof Component){
            newChild = newChild.hostElement;
        }
        if(refChild instanceof Component){
            refChild = refChild.hostElement;
        }
        refChild.parentNode.insertBefore(newChild, refChild);
    },

    insertAfter : function(){},

    /** @param {string} type */
    /** @param {function} listener */
    /** @param {boolean} useCapture */
    /** @returns {void} */
    addEventListener : function(type, listener, useCapture){
        this.hostElement.addEventListener(type, listener, useCapture);
    },

    /** @param {string} type */
    /** @param {function} listener */
    /** @param {boolean} useCapture */
    /** @returns {void} */
    removeEventListener : function(type, listener, useCapture){
        this.hostElement.removeEventListener(type, listener, useCapture);
    },

    /** @param {Event} event */
    /** @returns {void} */
    dispatchEvent : function(event){
        this.hostElement.dispatchEvent(event);
    },

    /** @param {DOMString} selector */
    /** @returns {Node} */
    querySelector : function(selector){
        return Component.get(this.__content.parentElement.querySelector(selector));
    },

    /** @param {DOMString} selector */
    /** @returns {NodeList} */
    querySelectorAll : function(selector){
        return NodeListProxy(this.__content.parentElement.querySelectorAll(selector));
    },

    /** @param {DOMString} name */
    /** @param {DOMString} value */
    setAttribute : function(name, value){
        this.__hostElement.setAttribute(name, value);
    },

    /** @returns {DOMString} */
    getAttribute : function(name){
        return this.__hostElement.getAttribute(name);
    },

    /** @returns {Boolean} */
    hasAttribute : function(name){
        return this.__hostElement.hasAttribute(name);
    },

    /** @private Shim for mouseenter/leave */
    /** @param {event} event */
    __onmouseenter : function(event){
        var target = this.element;
        var related = event.relatedTarget;

        // For mousenter/leave call the handler if related is outside the target.
        // NB: No relatedTarget if the mouse left/entered the browser window
        if(!related || (related !== target && !target.contains(related))) {
            this.__mouseentered = !this.__mouseentered;
            this.__mouseentered ? this.onmouseenter(event) : this.onmouseleave(event);
            event.stopPropagation(); // mouseenter/leave events don't bubble
            return true;
        }
        return false;
    },



    // Custom Interfaces
    events : [],
    commands : [],

    /** @param {string} attribute */
    /** @returns {boolean} */
    toggleAttribute : function(attribute){
        var state = this.hostElement.getAttribute(attribute) === "true" ? false : true;
        this.hostElement.setAttribute(attribute, state);
        return state;
    },

    /** @returns {CommandController} */
    get commandController(){
        return this.__commandController;
    },

    /** @param {Event} event */
    /** @returns {boolean} */
    dispatchCommand : function(event){
        var target = event.target;
        var parentNode = this.hostElement.parentNode;
        // Bubble the command up the component
        while(target && target != parentNode){
            var cmd = target.getAttribute("data-command");
            if(cmd){
                break;
            }
            target = target.parentNode;
        }
        if(!cmd) return false;

        if(this.commandController.supportsCommand(cmd)) {
            if(this.commandController.isCommandEnabled(cmd)){
                console.info("Dispatching Command: " +cmd);
                if(this.commandController.execCommand(cmd) !== false){
                    this.oncommand(cmd);
                    event.stopPropagation();
                }
            }
            return true;
        }

        return false;
    },

    /** @param {string} command */
    /** @param {boolean} [state] */
    /** @returns {void} */
    oncommand : function(command, state){
        var elem = this.hostElement.querySelector("[data-command='" +command +"']");
        if(elem){
            state = state != undefined ? state : elem.getAttribute("aria-pressed") == "true" ? false : true;
            elem.setAttribute("aria-pressed", state);
        }
    }
}

Component.map = new WeakMap();

/** @param {Component} component */
/** @param {Node} node */
Component.set = function(component, node) {
    this.map.set(node, component);
}

/** @param {Node} node */
/** @returns {Component|Node} */
Component.get = function(node){
    if(node){
        return this.map.get(node) || node;
    }
    return undefined;
}

/** @param {Component} component */
/** @param {DOMString} event */
/** @param {object} data */
/** @returns {event} */
Component.dispatchCustomEvent = function(component, event, data){
    var event = new CustomEvent(event, {detail : data});
    component.dispatchEvent(event);
    return event;
}


/** @param {DOMString} event */
/** @param {object} params */
/** @returns {event} */
function CustomEventShim(event, params){
    params = params || { bubbles: true, cancelable: true, detail: undefined };
    var evt = document.createEvent("CustomEvent");
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
}
if(window.CustomEvent === undefined){
    CustomEvent.prototype = window.Event.prototype;
    window.CustomEvent = CustomEventShim;
}


var UI = {
    Component : Component,
    EventTarget : ComponentEventTarget,
    importTemplate : importTemplate,
    Command : Command,
    CommandController : CommandController
}

//module.exports = UI;
