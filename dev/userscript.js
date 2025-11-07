// ==UserScript==
// @name         WikiShield Development Hot-reloading Userscript
// @namespace    http://en.wikipedia.org/
// @match        https://en.wikipedia.org/*
// @version      2025-11-06
// @description  CC BY-SA 4.0
// @author       Monkeysmashingkeyboards
// @icon         https://www.google.com/s2/favicons?sz=64&domain=en.wikipedia.org
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function() {
    'use strict';


    function loadScript() {
        GM.xmlHttpRequest({
            method: 'GET',
            url: 'http://localhost:8080/build.js',
            onload: function(response) {
                const script = response.responseText;
                eval(script);
            },
            onerror: function(error) {
                console.error('[WikiShield Dev] Error loading script:', error);
                console.error('Check if your devserver is running on http://localhost:8080');
            }
        });
    }
    console.log('[WikiShield Dev] Hot-reload enabled');
    loadScript();
}());