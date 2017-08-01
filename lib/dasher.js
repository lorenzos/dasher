var url = require('url')
var dashButton = require('node-dash-button');
var request = require('request')
var retry = require('retry')
const execFile = require('child_process').execFile;
process.title = "dasher"

function doLog(message) {
  console.log('[' + (new Date().toISOString()) + '] ' + message);
}

function DasherButton(button) {
  var options = {headers: button.headers, body: button.body, json: button.json, formData: button.formData}
  var debug = button.debug || false;
  this.dashButton = dashButton(button.address, button.interface, button.timeout, button.protocol)
  var buttonList = {};

  this.dashButton.on("detected", function() {
      
    if(!buttonList.hasOwnProperty(button.address)){
        buttonList[button.address] = 1;
    } else {
        buttonList[button.address]++;
    }
    doLog(button.name + " pressed. Count: " +  buttonList[button.address]);    
    if (debug){
      doLog("Debug mode, skipping request.");
      console.log(button);
    } else if (typeof button.cmd !== 'undefined' && button.cmd != "") {
      doCommand(button.cmd, button.name)
    } else {
      doRequest(button.url, button.method, button.retries || 0, options)
    }
  })

  doLog(button.name + " added.")
}

function doCommand(command, name, callback) {
  const child = execFile(command, [name], (error, stdout, stderr) => {
    if (error) {
      // Stripping a trailing new line
      output = stderr.replace (/\s+$/g, "");
	  doLog(`There was an error: ${output}`);
	}

    if (stdout != "") {
      // Stripping a trailing new line
      output = stdout.replace (/\s+$/g, "");
      doLog(`Command output: ${output}`);
    }
  });
}

function doRequest(requestUrl, method, retries, options, callback) {
  options = options || {}
  options.query = options.query || {}
  options.json = options.json || false
  options.headers = options.headers || {}

  var reqOpts = {
    url: url.parse(requestUrl),
    method: method || 'GET',
    qs: options.query,
    body: options.body,
    json: options.json,
    headers: options.headers,
    formData: options.formData
  }

  var operation = retry.operation({
    retries: retries
  });

  operation.attempt(function() {

    request(reqOpts, function onResponse(error, response, body) {

      var isError = false; // TRUE when any error

      // Errors logging
      if (error) {
        doLog("there was an error");
        console.log(error);
        isError = true;
      } else {
        if (response.statusCode === 401) {
          doLog("Not authenticated");
          isError = true;
        }
        if (response.statusCode < 200 || response.statusCode > 299) {
          doLog("Unsuccessful status code");
          isError = true;
        }
      }

      // If any error, retry, or give up if retries limit reached
      if (isError) {
        if (operation.retry(true)) return; // Will retry, limit not reached
        if (retries > 0) doLog("Failed after " + retries + " retries, giving up");
      }
    
      if (callback) {
        callback(error, response, body)
      }

    });

  });

}

module.exports = DasherButton
