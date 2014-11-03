// libraries
var url = require("url");
var querystring = require("querystring");

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
    "Origin": 							"http://psapp.dl.playstation.net",
    "Access-Control-Request-Headers": 	"Origin, Accept-Language, Authorization, Content-Type, Cache-Control",
    "Cache-Control": 					"no-cache",
    "X-Requested-With": 				"com.scee.psxandroid",
	"platform": 						"54bd6377db3b48cba9ecc44bff5a410b",
    "User-Agent": 						useragent
};

// standard oauth POST data
var oauth_settings = {
    "redirect_uri": 	"com.scee.psxandroid.scecompcall://redirect",
    "client_id": 		"b0d0d7ad-bb99-4ab1-b25e-afa0c76577b0",
    "client_secret": 	"Zo4y8eGIa3oazIEp",
    "scope": 			"psn:sceapp",
    "duid": 			"00000005006401283335353338373035333434333134313a433635303220202020202020202020202020202020",
    "state": 			"x"
};

var urls = {
	login_base: 	"https://auth.api.sonyentertainmentnetwork.com",
	oauth: 			"https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/token",
};

/** PSNObj class that holds connection logic */
function PSNObj(options)
{
	var parent = this;

	// store our auth data in the class
	var auth_obj = {
		npLanguage: 	"en",
		access_token: 	false,
		// user's region
		region: 		false,
		// auth_code (used to get access token)
		auth_code: 		false,
		// refresh token to maintain connection over time
		refresh_token: 	false,
		// authenticated user's PSN ID
		username: 		false
	};

	// store email & password to login
	var login_details = {
		email: false,
		password: false
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


	/** Session saving/loading */
	this.OnSave = function (func)
	{
		SaveFunc = func;
	}
	SaveFunc = false;
	function DoSave(callback)
	{
		if (SaveFunc)
		{
			// stringify
			var JSONString = JSON.stringify(auth_obj);
			// Base64 encode
			var saveString = new Buffer(JSONString).toString('base64');

			SaveFunc(saveString, function()
				{
					if (callback) callback();
				}
			);
		}
		else
		{
			if (callback) callback();
		}
	}
	this.Load = function(dataObj, callback)
	{
		// try to parse data
		var data;
		try
		{
			data = JSON.parse(new Buffer(dataObj, 'base64').toString('utf8'));
		}
		catch(JSONError)
		{
			Log("Error parsing loaded data: " + JSONError);
			if (callback) callback("Error parsing loaded data: " + JSONError);
			return;
		}

		// check at least auth_code is present
		if (!data.auth_code)
		{
			if (callback) callback("Invalid loaded data object");
			return;
		}

		// load up saved data object
		Log("Loaded up data successfully!");
		auth_obj = data;

		if (callback) callback(false);
	};


	/** Clean up a given username, PSN (according to Wikipedia) only accepts alphanumberic, underscores and hyphens */
	this.CleanPSN = function(username)
	{
	    return username.replace(/[^a-zA-Z0-9_\-\|]/g, "");
	}

	/** Clean up username list (used in getting individual messages etc) */
	this.CleanPSNList = function(input)
	{
		return input.replace(/[^a-zA-Z0-9_\-\|,~]/g, "");
	}

	/** Check a PSN name is valid (must run against validate regex and be between 2 and 21 characters) */
	this.CheckPSN = function(username)
	{
	    username = this.CleanPSN(username);

	    if ((username.length < 2) || (username.length>21))
	    {
	        return false;
	    }

	    return username;
	}

	/** Replace {{id}} with the supplied username after cleaning up the username */
	this.ReplacePSNUsername = function(input, username)
	{
		// cleanup username
		username = parent.CheckPSN(username);

		// return replaced {{id}} if username is valid
		if (username && input) return input.replace(/{{id}}/g, username);

		// failthrough, return original input
		return input;
	}


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

	/** Get OAuth data */
	function GetOAuthData(additional_fields)
	{
		var ret_fields = {};
		// clone base oauth settings
		for(var key in oauth_settings)
		{
			ret_fields[key] = ParseStaches(oauth_settings[key]);
		}

		// add additional fields (if supplied)
		if (additional_fields) for(var key in additional_fields)
		{
			ret_fields[key] = ParseStaches(additional_fields[key]);
		}

		return ret_fields;
	}

	/** Make a PSN GET request */
	function URLGET(url, fields, method, callback)
	{
		// method variable is optional
		if (typeof method == "function")
		{
			callback = method;
			method = "GET";
		}

		_URLGET(url, fields, GetHeaders({"Access-Control-Request-Method": method}), method, function(err, body) {
			if (err)
			{
				// got error, bounce it up
				if (callback) callback(err);
				return;
			}
			else
			{
				var JSONBody;
				if (typeof body == "object")
				{
					// already a JSON object?
					JSONBody = body;
				}
				else
				{
					// try to parse JSON body
					try
					{
						JSONBody = JSON.parse(body);
					}
					catch(parse_err)
					{
						// error parsing JSON result
						Log("Parse JSON error: " + parse_err + "\r\nURL:\r\n" + url + "\r\nBody:\r\n" + body);
						if (callback) callback("Parse JSON error: " + parse_err);
						return;
					}
				}

				// success! return JSON object
				if (callback) callback(false, JSONBody);
			}
		});
	}
	function _URLGET(url, fields, headers, method, callback)
	{
		// method variable is optional
		if (typeof method == "function")
		{
			callback = method;
			method = "GET";
		}

		var settings = 
		{
			url: url,
			headers: headers,
			method: method
		};

		// put fields in correct place in HTTP header depending on method
		if (method == "GET")
		{
			if (fields) settings.url = settings.url + "?" + querystring.stringify(fields);
		}
		else if (method == "POST")
		{
			if (fields) settings.json = fields;
		}

		// Make a PSN GET request using request() lib
		request(
			settings,
			function(err, response, body)
			{
				if (err)
				{
					Log("Request error: " + err);
					if (callback) callback("Request error: " + err);
					return;
				}
				else if (response.statusCode == 401)
				{
					Log("Got error " + response.statusCode+", refreshing access token");
					// token expired, unset access token
					auth_obj.access_token = false;
					GetAccessToken(function(error) {
						if (error)
						{
							if (callback) callback("Failed to refresh token: " + error);
							return;
						}

						_URLGET(url, fields, headers, method, callback);
					});
					return;
				}
				else if (response.statusCode > 300)
				{
					if (response.body && response.body.error)
					{
						// we also got a nice error message!
						if (callback) callback("Server error: " + response.body.error + " :: " + response.body.errorDescription);
						return;
					}
					// server successfully returned, but returned an error
					var JSONBody;
					try
					{
						JSONBody = JSON.parse(response.body);
					}
					catch(error_err)
					{
					}

					if (JSONBody && JSONBody.error && JSONBody.error.message)
					{
						if (callback) callback("Server error: " + response.statusCode + ": " + JSONBody.error.code + " - " + JSONBody.error.message);
					}
					else
					{
						if (callback) callback("Server error: " + response.statusCode);
					}
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
		if (typeof input != "string") return input;

		// replace {{lang}}
		var ret = input.replace(/{{lang}}/g, auth_obj.npLanguage);
		// replace {{access_token}}
		if (auth_obj.access_token) ret = ret.replace(/{{access_token}}/g, auth_obj.access_token);
		// replace {{region}}
		if (auth_obj.region) ret = ret.replace(/{{region}}/g, auth_obj.region);
		// replace {{psn}} with current user's PSN username
		if (auth_obj.username) ret = ret.replace(/{{psn}}/g, auth_obj.username);

		return ret;
	}

	/** Login to app and get auth token */
	function Login(callback)
	{
		Log("Making OAuth Request...");
		// start OAuth request (use our internal GET function as this is different!)
		_URLGET(
			// URL
			urls.login_base + "/2.0/oauth/authorize",
			// query string
			GetOAuthData({
				response_type: "code",
				service_entity: "urn:service-entity:psn",
				returnAuthCode: true,
				cltm: "1399637146935"
			}),
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
				                'j_username': login_details.email,
				                'j_password': login_details.password
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
					                			auth_obj.auth_code = auth_result.query.authCode;
					                			if (callback) callback(false);
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

	/** Get an access token using the PSN oauth service using our current auth config */
	function GetAccessToken(callback)
	{
		// do we have a refresh token? Or do we need to login from scratch?
		if (auth_obj.refresh_token)
		{
			// we have a refresh token!
			Log("Refreshing session...");

			if (!auth_obj.refresh_token)
			{
				if (callback) callback("No refresh token found!");
				return;
			}

			// request new access_token
			request.post(
				{
					url: urls.oauth,
					form: GetOAuthData({
						"grant_type": 		"refresh_token",
						"refresh_token": 	auth_obj.refresh_token
					})
				},
				function(err, response, body)
				{
					_ParseTokenResponse(err, body, callback);
				}
			);
		}
		else
		{
			// no refresh token, sign-in from scratch
			Log("Signing in with OAuth...");

			// make sure we have an authcode
			if (!auth_obj.auth_code)
			{
				if (callback) callback("No authcode available for OAuth!");
				return;
			}

			// request initial access_token
			request.post(
				{
					url: urls.oauth,
					form: GetOAuthData({
						"grant_type": 	"authorization_code",
						"code": 		auth_obj.auth_code
					})
				},
				function(err, response, body)
				{
					_ParseTokenResponse(err, body, callback);
				}
			);
		}
	}

	/** Helper function to parse OAuth responses (to save code duplication) */
	function _ParseTokenResponse(err, body, callback)
	{
		if (err)
		{
			if (callback) callback("Request error: " + err);
			return;
		}

		// try to parse result
		var responseJSON;
		try
		{
			responseJSON = JSON.parse(body);
		}
		catch (JSONerror)
		{
			if (callback) callback("JSON Parse error: " + JSONerror);
			return;
		}

		// check server response for error
		if (responseJSON.error_description)
		{
			if (callback) callback("Server response error " + responseJSON.error_code + ": " + responseJSON.error_description);
			return;
		}

		// check we got an access token
		if (!responseJSON.access_token)
		{
			if (callback) callback("No access token received from PSN OAuth");
			return;
		}

		Log("Got successful OAuth result");

		// store our new tokens
		auth_obj.access_token = 	responseJSON.access_token;
		auth_obj.refresh_token = 	responseJSON.refresh_token;
		// calculate expire time of these tokens (shave off half a minute)
		auth_obj.expire_time =		(new Date().getTime()) + ((responseJSON.expires_in - 30) * 1000);

		// save the data object
		DoSave(function()
			{
				// return no error
				if (callback) callback(false);
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
		Login(function(err, auth_code) {
			if (err)
			{
				if (callback) callback(err);
			}
			else
			{
				Log("Got authcode: " + auth_code);
				// store our auth_code
				auth_obj.auth_code = auth_code;

				GetAccessToken(function(error) {
					if (error)
					{
						Log(error);
						return;
					}

					// success!
					callback(false);
				});
			}
		});
	}

	/** Fetch the user's profile data */
	function GetUserData(callback)
	{
		Log("Fetching user profile data");

		// get the current user's data
		parent.Get("https://vl.api.np.km.playstation.net/vl/api/v1/mobile/users/me/info", {}, function(error, data)
		{
			if (error)
			{
				Log("Error fetching user profile: " + error);
				if (callback) callback("Error fetching user profile: " + error);
				return;
			}

			if (!data.onlineId)
			{
				Log("Missing PSNId from profile result: " + JSON.stringify(data, null, 2));
				if (callback) callback("Missing PSNId from profile result: " + JSON.stringify(data, null, 2));
				return;
			}

			// store user ID
			Log("We're logged in as " + data.onlineId);
			auth_obj.username = data.onlineId;
			// store user's region too
			auth_obj.region = 	data.region;

			// save updated data object
			DoSave(function()
				{
					// return no error
					if (callback) callback(false);
				}
			);
			// supply self to let API know we are a token fetch function
		}, GetUserData);
	}

	/** Check the session's tokens are still valid! */
	// token_fetch var is the function calling the token check in cases where the function is actually already fetching tokens!
	function CheckTokens(callback, token_fetch)
	{
		// build list of tokens we're missing
		var todo = [];

		// force token_fetch to an array
		token_fetch = [].concat(token_fetch);

		// make sure we're actually logged in first
		if (!auth_obj.auth_code)
		{
			Log("Need to login - no auth token found");
			todo.push(Login);
		}

		if (!auth_obj.expire_time || auth_obj.expire_time < new Date().getTime())
		{
			// token has expired! Fetch access_token again
			Log("Need to fetch access tokens - tokens expired");
			todo.push(GetAccessToken);
		}
		else if (!auth_obj.access_token)
		{
			// we have no access token (?!)
			Log("Need to fetch access tokens - no token available");
			todo.push(GetAccessToken);
		}

		if (!auth_obj.username || !auth_obj.region)
		{
			// missing player username/region
			Log("Need to fetch userdata - no region or username available");
			todo.push(GetUserData);
		}

		if (todo.length == 0)
		{
			// everything is fine
			if (callback) callback(false);
		}
		else
		{
			// work through our list of tokens we need to update
			var step = function()
			{
				var func = todo.shift();
				if (!func)
				{
					// all done!
					if (callback) callback(false);
					return;
				}

				if (token_fetch.indexOf(func) >= 0)
				{
					// if we're actually calling a token fetch function, skip!
					process.nextTick(step);
				}
				else
				{
					func(function(error) {
						if (error)
						{
							// token fetching error!
							if (callback) callback(error);
							return;
						}

						// do next step
						process.nextTick(step);
					});
				}
			};

			// start updating tokens
			process.nextTick(step);
		}
	}


	/** Make a PSN request */
	function MakePSNRequest(method, url, fields, callback, token_fetch)
	{
		// use fields var as callback if it's missed out
		if (typeof fields == "function")
		{
			token_fetch = false;
			callback = fields;
			fields = {};
		}
		else if (typeof method == "function")
		{
			token_fetch = false;
			callback = method;
		}

		// parse stache fields in fields list
		for(var field_key in fields)
		{
			fields[field_key] = ParseStaches(fields[field_key]);
		}

		CheckTokens(function(error)
		{
			// check our tokens are fine
			if (!error)
			{
				// make PSN GET request
				URLGET(
					// parse URL for region etc.
					ParseStaches(url),
					fields,
					method,
					function(error, data)
					{
						if (error)
						{
							Log("PSN " + method + " Error: " + error);
							if (callback) callback(error);
							return;
						}

						if (data.error && (data.error.code === 2105858 || data.error.code === 2138626))
						{
							// access token has expired/failed/borked
							//  login again!
							Log("Access token failure, try to login again.");
							Login(function(error) {
								if (error)
								{
									if (callback) callback(error);
									return;
								}

								// call ourselves
								parent.Get(url, fields, callback, token_fetch);
							});
						}

						if (data.error && data.error.message)
						{
							// server error
							if (callback) callback(data.error.code + ": " + data.error.message, data.error);
							return;
						}

						// everything is fine! return data
						if (callback) callback(false, data);
					}
				);
			}
			else
			{
				Log("Token error: " + error);
				if (callback) callback(error);
				return;
			}
		}, token_fetch);
	}


	this.Get = function(url, fields, callback, token_fetch)
	{
		MakePSNRequest("GET", url, fields, callback, token_fetch);
	}
	this.Post = function(url, fields, callback, token_fetch)
	{
		MakePSNRequest("POST", url, fields, callback, token_fetch);
	}
	this.Put = function(url, fields, callback, token_fetch)
	{
		MakePSNRequest("PUT", url, fields, callback, token_fetch);
	}
	this.Delete = function(url, fields, callback, token_fetch)
	{
		MakePSNRequest("DELETE", url, fields, callback, token_fetch);
	}


	/** Get the logged in user's PSN ID and region */
	this.GetPSN = function(forceupdate, callback)
	{
		// forceupdate is optional
		if (typeof forceupdate == "function")
		{
			callback = forceupdate;
			forceupdate = false;
		}

		// call manual reload or just check tokens toggled on forceupdate bool
		var callFunc = forceupdate ? GetUserData : CheckTokens;
		callFunc(function(error)
			{
				if (error)
				{
					if (callback) callback(error);
					return;
				}

				// return username from auth data
				if (callback) callback(false, {psn: auth_obj.username, region: auth_obj.region});
			}
		);
	}

	/** Called when we're all setup */
	function Ready()
	{
		if (options.autoconnect)
		{
			// make a connection request immediately (optional)
			parent.GetPSN(true, function() {
				if (options.onReady) options.onReady();
				return;
			});
		}
		else
		{
			// just callback that we're ready (if anyone is listening)
			if (options.onReady) options.onReady();
			return;
		}
	}



	// load request library
	var request = require('request').defaults({
		// use a cookie jar for logging in
	    jar: true
	});



	// init library
	if (options)
	{
		/** In-built optional debug log */
		if (options.debug)
		{
			this.OnLog(DebugLog);
		}

		/** Optionally debug the Request lib */
		if (options.requestDebug)
		{
			require('request').debug = true;
		}

		// store email and password
		if (options.email && options.password)
		{
			login_details.email = options.email;
			login_details.password = options.password;
		}

		// optionally read/write to an authfile
		if (options.authfile)
		{
			// register to OnSave
			parent.OnSave(function(data, callback)
			{
				fs.writeFile(options.authfile, data, function(err)
				{
					if (err)
					{
						Log("Failed to write save data: " + err);
					}

					// always call the callback anyway
					if (callback) callback();
				});
			});

			// load up file (if it already exists)
			var fs = require("fs");
			fs.exists(options.authfile, function(exists)
			{
				if (exists)
				{
					// load previously saved data
					fs.readFile(options.authfile, 'ascii', function(err, data)
					{
						parent.Load(data, function(err)
						{
							if (err)
							{
								console.log(err);
								return;
							}

							// mark as ready
							Ready();
						});
					});
				}
				else
				{
					// couldn't find file, but still mark ready to go!
					Ready();
				}
			});
		}
	}
}

// expose entire PSNObj class
module.exports = PSNObj;