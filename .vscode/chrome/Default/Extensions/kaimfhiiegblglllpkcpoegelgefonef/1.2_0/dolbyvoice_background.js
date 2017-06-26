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
  if (chrome.runtime.lastError && typeof chrome.runtime.lastError.message === 'string') {
    msg += ' [' + chrome.runtime.lastError.message + '].';
  }
  //console.log(msg);
}

function connectToLauncher(version) {
  var port = chrome.runtime.connectNative('com.dolby.voice.launcher.' + version);
  port.DolbyVoicePagePort = null;
  port.DolbyVoiceVersion = version;
  port.onMessage.addListener(function(msg, app_port) {
    if (app_port.DolbyVoicePagePort != null && typeof msg.type === 'string') {
      switch (msg.type) {
        case 'msg':
          logMessage('Received event with message, forwarding from bg_extension to page_extension.');
          app_port.DolbyVoicePagePort.postMessage({ DolbyVoiceMsgP1x2: 'msg', raw_value: msg.raw_value, base64_value: msg.base64_value, Version: app_port.DolbyVoiceVersion });
          break;
        case 'connection':
          logMessage('Received event with connection status, forwarding from bg_extension to page_extension.');
          app_port.DolbyVoicePagePort.postMessage({ DolbyVoiceMsgP1x2: 'connection', status: msg.raw_value, Version: app_port.DolbyVoiceVersion });
          break;
        default:
          logMessage('Received event of unknown type [' + msg.type + '], ignoring.');
      }
    }
    else {
      logMessage('Received invalid event, ignoring.');
    }
  });
  port.onDisconnect.addListener(function(app_port) {
    if (app_port.DolbyVoicePagePort !== null) {
      if (chrome.runtime.lastError && typeof chrome.runtime.lastError.message === 'string' && chrome.runtime.lastError.message.indexOf('host not found') >= 0) {
        logMessage('App port disconnected, sending missing_launcher status to the page port,  disconnecting page port.');
        app_port.DolbyVoicePagePort.postMessage({ DolbyVoiceMsgP1x2: 'connection', status: 'missing_launcher', Version: app_port.DolbyVoiceVersion });
      }
      else {
        logMessage('App port disconnected, disconnecting page port.');
      }
      app_port.DolbyVoicePagePort.DolbyVoiceAppPort = null;
      app_port.DolbyVoicePagePort.disconnect();
      app_port.DolbyVoicePagePort = null;
      app_port.DolbyVoiceVersion = null;
    }
  });
  return port;
}

chrome.runtime.onConnect.addListener(function(port) {
  port.DolbyVoiceAppPort = null;
  port.DolbyVoiceVersion = null;
  port.onMessage.addListener(function(msg, page_port) {
    logMessage('Received message from page [' + msg.DolbyVoiceMsgE1x2 + ']');
    switch (msg.DolbyVoiceMsgE1x2) {
      case 'connect':
        if (page_port.DolbyVoiceAppPort === null) {
          page_port.DolbyVoiceAppPort = connectToLauncher(msg.Version);
          page_port.DolbyVoiceAppPort.DolbyVoicePagePort = port;
          logMessage('New connection from page_extension, external process started.');
        }
        break;
      case 'msg':
        if (page_port.DolbyVoiceAppPort != null) {
          logMessage('Sending message to the process: [' + msg.msg + ']');
          page_port.DolbyVoiceAppPort.postMessage(msg.msg);
        }
        break;
      default:
        break;
    }
  });
  port.onDisconnect.addListener(function(page_port) {
    if (page_port.DolbyVoiceAppPort !== null) {
      logMessage('Page port disconnected, disconnecting app port.');
      page_port.DolbyVoiceAppPort.DolbyVoicePagePort = null;
      page_port.DolbyVoiceAppPort.disconnect();
      page_port.DolbyVoiceAppPort = null;
      page_port.DolbyVoiceVersion = null;
    }
  });
});

