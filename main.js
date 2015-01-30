#!/usr/bin/env node

var http = require('http'),
    localtunnel = require('localtunnel'),
    parseArgs = require('minimist'),
    shell = require('shelljs'),
    fs = require('fs'),
    path = require('path');

var tunneledUrl = "";
var PORT = 8008;
var USAGE = "Error missing args. \n Usage: $cordova-paramedic --platform CORDOVA-PLATFORM --plugin PLUGIN-PATH";
var TEMP_PROJECT_PATH = "tmp";
var storedCWD = process.cwd();

var plugin,platformId;

run();

// main program here 
function run() {
    init();
    createTempProject();
    installPlugins();
    startServer();
}

function init() {
    var argv = parseArgs(process.argv.slice(2),{
        plugin:".",
        platform:""
    });

    if(!argv.platform || !argv.plugin) {
        console.log(USAGE);
        process.exit(1);
    }

    platformId = argv.platform;
    plugin = argv.plugin;

    var cordovaResult = shell.exec('cordova --version', {silent:true});
    if(cordovaResult.code) {
        console.error(cordovaResult.output);
        process.exit(cordovaResult.code);
    }
}

function createTempProject() {
    console.log("cordova-paramedic :: creating temp project");
    shell.exec('ls');
    shell.exec('cordova create ' + TEMP_PROJECT_PATH);
    shell.cd(TEMP_PROJECT_PATH);
}

function installPlugins() {
    //console.log("cordova-paramedic :: installing " + plugin);
    shell.exec('cordova plugin add ' + plugin);

    //console.log("cordova-paramedic :: installing " + path.join(plugin,'tests'));
    shell.exec('cordova plugin add ' + path.join(plugin,'tests'));

    //console.log("cordova-paramedic :: installing plugin-test-framework");
    shell.exec('cordova plugin add https://github.com/apache/cordova-plugin-test-framework');

}

function addAndRunPlatform() {
    setConfigStartPage();
    //console.log("cordova-paramedic :: adding platform and running");
    shell.exec('cordova platform add ' + platformId);
    shell.exec('cordova prepare');
    // limit runtime to 5 minutes
    setTimeout(function(){
        console.log("This test seems to be block :: 5 minute timeout. Exiting ...");
        cleanUpAndExitWithCode(1);
    },(5 * 60 * 1000));
    shell.exec('cordova emulate ' + platformId.split("@")[0] + " --phone");
}

function cleanUpAndExitWithCode(exitCode) {
    shell.cd(storedCWD);
    process.exit(exitCode);
}

function writeMedicLogUrl(url) {
    console.log("cordova-paramedic :: writing medic log url to project");
    var obj = {logurl:url};
    fs.writeFileSync(path.join("www","medic.json"),JSON.stringify(obj));
}


function setConfigStartPage() {

    console.log("cordova-paramedic :: setting app start page to test page");

    var fileName = 'config.xml';
    var configStr = fs.readFileSync(fileName).toString();
    if(configStr) {
        configStr = configStr.replace("src=\"index.html\"","src=\"cdvtests/index.html\"");
        fs.writeFileSync(fileName, configStr);
    }
    else {
        console.error("Oops, could not find config.xml");
    }
}

function startServer() {
    console.log("cordova-paramedic :: starting local medic server " + platformId);
    var server = http.createServer(requestListener);
    server.listen(PORT, '127.0.0.1',function onServerConnect() {

        if(platformId == "ios") {
            console.log('platform is ios');
            writeMedicLogUrl("http://127.0.0.1:" + PORT);
            addAndRunPlatform();
        }
        else {
            //localtunnel(PORT, tunnelCallback); // TODO
            console.log("Only ios is currently supported");
            cleanUpAndExitWithCode(1);
        }
    });
}

function requestListener(request, response) {
    if (request.method == 'PUT' || request.method == 'POST') {
        var body = '';
        request.on('data', function (data) {
            body += data;
            // Too much POST data, kill the connection!
            if (body.length > 1e6) {
                req.connection.destroy();
            }
        });
        request.on('end', function (res) {
            if(body.indexOf("mobilespec")  == 2){ // {\"mobilespec\":{...}}
                try {
                    console.log("body = " + body);
                    var results = JSON.parse(body);
                    console.log("Results:: ran " + 
                        results.mobilespec.specs + 
                        " specs with " + 
                        results.mobilespec.failures + 
                        " failures");
                    cleanUpAndExitWithCode(0);
                }
                catch(err) {
                    console.log("parse error :: " + err);
                    cleanUpAndExitWithCode(1);
                }
            }
            else {
                console.log("console-log:" + body);
            }
        });
    }
    else {
        console.log(request.method);
        response.writeHead(200, { 'Content-Type': 'text/plain'});
        response.write("Hello"); // sanity check to make sure server is running
        response.end();
    }
}

function tunnelCallback(err, tunnel) {
    if (err){
        console.log("failed to create tunnel url, check your internet connectivity.")
        cleanUpAndExitWithCode(1);
    }
    else {
        // the assigned public url for your tunnel
        // i.e. https://abcdefgjhij.localtunnel.me
        tunneledUrl = tunnel.url;
        console.log("cordova-paramedic :: tunneledURL = " + tunneledUrl);
        writeMedicLogUrl(tunneledUrl);
        addAndRunPlatform();
    }
}

