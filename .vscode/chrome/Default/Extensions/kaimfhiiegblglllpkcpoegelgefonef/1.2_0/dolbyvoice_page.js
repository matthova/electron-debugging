/*****************************************************************************
 * This program is protected under international and U.S. copyright laws as  *
 * an unpublished work. This program is confidential and proprietary to the  *
 * copyright owners. Reproduction or disclosure, in whole or in part, or the *
 * production of derivative works without the express permission of          *
 * the copyright owners is prohibited.                                       *
 *                                                                           *
 *                Copyright (C) 2014-2016 by Dolby International AB.         *
 *                            All rights reserved.                           *
 *****************************************************************************/

function logMessage(msg) {
  //console.log(msg);
}

var dolby_voice_extension = { port: null, state: 10 };

function disconnect() {
  if (dolby_voice_extension.port != null) {
    logMessage('Disconnecting page_extension from the bg_extension.');
    dolby_voice_extension.port.disconnect();
    dolby_voice_extension.port = null;
    dolby_voice_extension.state = 0;
    return true;
  }
  return false;
}

function connect(version) {
  if (dolby_voice_extension.port === null) {
    logMessage('Connecting from page_extension to bg_extension with version = ' + version);
    dolby_voice_extension.port = chrome.runtime.connect(chrome.runtime.id);
    dolby_voice_extension.port.version = version;
    dolby_voice_extension.port.postMessage({ DolbyVoiceMsgE1x2: 'connect', Version: version });
    dolby_voice_extension.port.onMessage.addListener(function(msg) {
      dolby_voice_extension.state = 0;
      if (typeof msg.DolbyVoiceMsgP1x2 === 'string' && typeof msg.Version === 'string' && msg.Version === dolby_voice_extension.port.version) {
        logMessage('Page extension received message [' + msg.DolbyVoiceMsgP1x2 + '] from bg_extension.');
        window.postMessage(msg, '*');
        if (msg.DolbyVoiceMsgP1x2 === 'connection' && msg.status !== 'connected') {
          disconnect();
        }
      }
    });
    dolby_voice_extension.port.onDisconnect.addListener(function() {
      if (dolby_voice_extension.state > 0) {
        dolby_voice_extension.port = null;
        --dolby_voice_extension.state;
        setTimeout(connect, 50, version);
      }
      else {
        if (chrome.runtime.lastError && typeof chrome.runtime.lastError.message == 'string') {
          logMessage('Page_extension disconnected from bg_extension: [' + chrome.runtime.lastError.message + ']!');
        }
        else {
          logMessage('Page_extension disconnected from bg_extension!');
        }
        window.postMessage({ DolbyVoiceMsgP1x2: 'connection', status: 'disconnected', Version: dolby_voice_extension.port.version }, '*');
        dolby_voice_extension.port = null;
        dolby_voice_extension.state = 0;
      }
    });
    logMessage('Page_extension connected to the bg_extension.');
  }
}

window.addEventListener('message', function(event) {
  if (event.source === window && typeof event.data.DolbyVoiceMsgE1x2 === 'string' && typeof event.data.Version === 'string') {
    if (dolby_voice_extension.port !== null && dolby_voice_extension.port.version != event.data.Version) {
      logMessage('Received message with version = ' + event.data.version + ', expected: ' + dolby_voice_extension.port.version + '.');
      return;
    }
    switch (event.data.DolbyVoiceMsgE1x2) {
      case 'connect':
        connect(event.data.Version);
        break;
      case 'disconnect':
        if (disconnect()) {
          window.postMessage({ DolbyVoiceMsgP1x2: 'connection', status: 'disconnected', Version: event.data.Version }, '*');
        }
        break;
      case 'ping':
        window.postMessage({ DolbyVoiceMsgP1x2: 'ping', Version: event.data.Version }, '*');
        break;
      default:
        if (dolby_voice_extension.port !== null) {
          logMessage('Forwarding command from page_extension to bg_extension [' + event.data.DolbyVoiceMsgE1x2 + ']');  
          dolby_voice_extension.port.postMessage(event.data);
        }
        break;
    }
  }
}, false);

window.postMessage({ DolbyVoiceMsgP1x2: 'ping' }, '*');

