// libraries
var url = require("url");

// Available languages
languages = [
	"ja",
	"en",
	"en-GB",
	"fr",
	"es",
	"es-MX",
	"de",
	"it",
	"nl",
	"pt",
	"pt-BR",
	"ru",
	"pl",
	"fi",
	"da",
	"no",
	"sv",
	"tr",
	"ko",
	"zh-CN",
	"zh-TW"
];

var useragent = "Mozilla/5.0 (Linux; U; Android 4.3; {{lang}}; C6502 Build/10.4.1.B.0.101) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30 PlayStation App/1.60.5/{{lang}}/{{lang}}";

// default request headers
var headers = {
    'Origin': 'http://psapp.dl.playstation.net',
    'Access-Control-Request-Headers': 'Origin, Accept-Language, Authorization, Content-Type, Cache-Control',
    'Cache-Control': 'no-cache',
    'X-Requested-With': 'com.scee.psxandroid',
	'platform': '54bd6377db3b48cba9ecc44bff5a410b',
    'User-Agent': useragent
};

var urls = {
	login_base: 'https://auth.api.sonyentertainmentnetwork.com',

};

/** PSNObj class that holds connection logic */
function PSNObj(options)
{
	// store our auth data in the class
	var auth_obj = {
		npLanguage: 	"en",
		access_token: 	false,
		// default to gb (will change after auth/login)
		region: 		"gb",
		// authcode (used to get access token)
		authcode: 		false
	};


	/** Basic Logging Registry */
	var logFuncs = [];
	this.OnLog = function(func)
	{
		logFuncs.push(func);
	}
	function Log(msg)
	{
		if (logFuncs.length == 0) return;

		for(var i=0; i<logFuncs.length; i++)
		{
			logFuncs[i](msg);
		}
	}

	/** In-Build logger */
	function DebugLog(msg)
	{
		console.log("[PSN] :: " + ((typeof msg == "object") ? JSON.stringify(msg, null, 2) : msg));
	}


	// load request library
	var request = require('request').defaults({
		// use a cookie jar for logging in
	    jar: true
	});


	/** Generate headers for a PSN request */
	function GetHeaders(additional_headers)
	{
		var ret_headers = {};
		// clone default headers into our return object (parsed)
		for(var key in headers)
		{
			ret_headers[key] = ParseStaches(headers[key]);
		}

		// add accept-language header based on our language
		ret_headers['Accept-Language'] = auth_obj.npLanguage + "," + languages.join(',');

		// add access token (if we have one)
		if (auth_obj.access_token)
		{
    		ret_headers['Authorization'] = 'Bearer ' + auth_obj.access_token;
		}

		// add additional headers (if supplied) (parsed)
		if (additional_headers) for(var key in additional_headers)
		{
			ret_headers[key] = ParseStaches(additional_headers[key]);
		}

		return ret_headers;
	}

	/** Make a PSN GET request */
	function GET(url, fields, callback)
	{
		_GET(url, fields, GetHeaders(), function(err, body) {
			if (err)
			{
				// got error, bounce it up
				if (callback) callback(err);
				return;
			}
			else
			{
				// try to parse JSON body
				var JSONBody;
				try
				{
					JSONBody = JSON.parse(body);
				}
				catch(parse_err)
				{
					// error parsing JSON result
					Log(response);
					Log("Parse JSON error: " + parse_err + "\r\nURL:\r\n" + url + "\r\nBody:\r\n" + body);
					if (callback) callback("Parse JSON error: " + parse_err);
					return;
				}

				// success! return JSON object
				if (callback) callback(false, JSONBody);
			}
		});
	}
	function _GET(url, fields, headers, callback)
	{
		// Make a PSN GET request using request() lib
		request(
			{
				url: url,
				// query-string fields
				qs: fields,
				headers: headers
			},
			function(err, response, body)
			{
				if (err)
				{
					Log("Request error: " + err);
					if (callback) callback("Request error: " + err);
					return;
				}
				else
				{
					// success! return body
					if (callback) callback(false, body, response);
				}
			}
		);
	}

	/** Our parser function for replacing {{lang}} etc. */
	function ParseStaches(input)
	{
		// replace {{lang}}
		var ret = input.replace(/{{lang}}/g, auth_obj.npLanguage);
		// replace {{access_token}}
		if (auth_obj.access_token) input.replace(/{{access_token}/g, auth_obj.access_token);
		// replace {{region}}
		if (auth_obj.region) input.replace(/{{region}}/g, auth_obj.region);

		return ret;
	}

	/** Login to app and get auth token */
	function Login(email, password, callback)
	{
		Log("Making OAuth Request...");
		// start OAuth request (use our internal GET function as this is different!)
		_GET(
			// URL
			urls.login_base + "/2.0/oauth/authorize",
			// query string
			{
				response_type: "code",
				service_entity: "urn:service-entity:psn",
				returnAuthCode: true,
				cltm: "1399637146935",
				redirect_uri: "com.scee.psxandroid.scecompcall://redirect",
				client_id: "b0d0d7ad-bb99-4ab1-b25e-afa0c76577b0",
				scope: "psn:sceapp"
			},
			// headers
			{
				'User-Agent': ParseStaches(useragent)
			},
			function(err, body, response)
			{
				if (err)
				{
					// return login error
					if (callback) callback(err);
					return;
				}
				else
				{
					// get the login path
					var login_referrer = response.req.path;

					Log("Logging in...");

					// now actually login using the previous URL as the referrer
					request(
						{
							url: urls.login_base + "/login.do",
							method: "POST",
				            headers:
				            {
				                'Origin': 'https://auth.api.sonyentertainmentnetwork.com',
				                'Referer': login_referrer
				            },
				            form:
				            {
				                'params': 'service_entity=psn',
				                'j_username': email,
				                'j_password': password
				            }
			        	},
				        function (err, response, body)
				        {
				        	if (err)
				        	{
				        		// login failed
				        		Log("Failed to make login request");
				        		if (callback) callback(err);
				        		return;
				        	}
				        	else
				        	{
					        	Log("Following login...");
					            request.get(response.headers.location, function (err, response, body)
					            {
					                if (!err)
					                {
					                	// parse URL
					                	var result = url.parse(response.req.path, true);
					                	if (result.query.authentication_error)
					                	{
											Log("Login failed!");
							        		if (callback) callback("Login failed!");
							        		return;
					                	}
					                	else
					                	{
					                		// no auth error!
					                		var auth_result = url.parse(result.query.targetUrl, true);
					                		if (auth_result.query.authCode)
					                		{
					                			Log("Got auth code: " + auth_result.query.authCode);
					                			if (callback) callback(false, auth_result.query.authCode);
					                			return;
					                		}
					                		else
					                		{
					                			Log("Auth error " + auth_result.query.error_code + ": " + auth_result.query.error_description);
								        		if (callback) callback("Auth error " + auth_result.query.error_code + ": " + auth_result.query.error_description);
								        		return;
					                		}
					                	}
					                }
					                else
					                {
					                    Log("Auth code fetch error: " + err);
					                    if (callback) callback(err);
					                    return;
					                }
					            });
					        }
				        }
				    );
				}
			}
		);
	}

	/** Connect to PSN */
	this.Connect = function(email, password, callback)
	{
		Log("Connecting to PSN...");

		// check we have login details
		if (!email || !password)
		{
			Log("Missing email/password arguments to Connect()!");

			if (callback) callback("Missing email/password arguments.");
			return;
		}

		// get auth token from login site
		Login(email, password, function(err, authcode) {
			if (err)
			{
				if (callback) callback(err);
			}
			else
			{
				Log("Got authcode: " + authcode);
			}
		});
	}

	if (options)
	{
		/** In-built optional debug log */
		if (options.debug)
		{
			this.OnLog(DebugLog);
		}
	}
}

// expose entire PSNObj class
module.exports = PSNObj;