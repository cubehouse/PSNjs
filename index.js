// load PSNRequest object (we will extend it with our helper functions)
var PSNRequest = require("./psn_request");

// which fields to request when getting a profile
var profileFields = "@default,relation,requestMessageFlag,presence,@personalDetail,trophySummary";
var messageFields = "@default,messageGroupId,messageGroupDetail,totalUnseenMessages,totalMessages,latestMessage";

/** Get a PSN user's profile
 * @param username		PSN username to request
 * @param callback		Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getProfile = function(username, callback)
{
	this.Get(
		this.ReplacePSNUsername("https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{id}}/profile", username),
		{
			fields: profileFields
		},
		callback
	);
}

PSNRequest.prototype.getMessageGroups = function(callback)
{
	this.Get(
		"https://{{region}}-gmsg.np.community.playstation.net/groupMessaging/v1/users/{{psn}}/messageGroups",
		{
			fields: messageFields
		},
		callback
	);
}

/** Get the signed-in user's activity feed
 * @param feed		type of feed, either "feed" or "news" (optional, defaults to "news")
 * @param filters	array of strings to filter by (optional, defaults to no filters)
 *					Allowed: PURCHASED, RATED, VIDEO_UPLOAD, SCREENSHOT_UPLOAD, PLAYED_GAME, STORE_PROMO, WATCHED_VIDEO, TROPHY, BROADCASTING, LIKED, PROFILE_PIC, FRIENDED and CONTENT_SHARE
 *					Use an empty array (or leave out argument) for all types
 * @param page 		Page of feed to load (default: 0)
 */
PSNRequest.prototype.getLatestActivity = function(feed, filters, page, callback)
{
	// handle defaults for missing feed or filters arguments
	if (typeof feed == "function")
	{
		callback = feed;
		feed = "news";
		filters = [];
		page = 0;
	}
	else if (typeof filters == "function")
	{
		callback = filters;
		filters = [];
		page = 0;
	}
	else if (typeof page == "function")
	{
		callback = page;
		page = 0;
	}

	this.Get(
		"https://activity.api.np.km.playstation.net/activity/api/v1/users/{{psn}}/" + (feed == "feed" ? "feed" : "news") + "/" + parseInt(page),
		{
			filters: filters
		},
		callback
	);
}

PSNRequest.prototype.getFriendURL = function(callback)
{
	this.Post("https://friendme.sonyentertainmentnetwork.com/friendme/api/v1/c2s/users/me/friendrequest", {"type" : "ONE"}, callback);
}


// return our new psn request object with our new helper functions
module.exports = PSNRequest;