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

/** Get current user's message groups
 * @param callback		Callback function with error (false if no error) and returned data object
 */
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

/** Get data from a specific message. All this data can be found in getMessageGroups
 * @param messageGroupId 	Group ID requested message belongs to
 * @param messageUid 		Message ID to fetch
 * @param messageKind		Kind of message (as int)
 * @param callback			Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getMessageContent = function(messageGroupId, messageUid, messageKind, callback)
{
	var contentKey = false;

	// convert kind ID to contentKey string
	messageKind = parseInt(messageKind);
	if (messageKind == 1) contentKey = "message"; // text (no attachment)
	else if (messageKind == 3) contentKey = "image-data-0"; // photo/image
	else if (messageKind == 1011) contentKey = "voice-data-0"; // voice data
	else if (messageKind == 8) contentKey = "store-url-0"; // PSN store link

	if (!contentKey)
	{
		// check js/people/groupmessage.js in PSN app to find contentKey types (and their kind IDs)
		if (callback) callback("Error: Unknown PSN message kind: " + messageKind);
		return;
	}

	this.Get(
		"https://{{region}}-gmsg.np.community.playstation.net/groupMessaging/v1/messageGroups/{{messageGroupId}}/messages/{{messageUid}}".
			replace("{{messageGroupId}}", this.CleanPSNList(messageGroupId)).
			replace("{{messageUid}}", parseInt(messageUid)),
		{
			contentKey: contentKey
		},
		callback
	);
}

// list valid filters for activity feeds
PSNRequest.prototype.activityTypes = [
	"PURCHASED",
	"RATED",
	"VIDEO_UPLOAD",
	"SCREENSHOT_UPLOAD",
	"PLAYED_GAME",
	"STORE_PROMO",
	"WATCHED_VIDEO",
	"TROPHY",
	"BROADCASTING",
	"LIKED",
	"PROFILE_PIC",
	"FRIENDED",
	"CONTENT_SHARE"
];

/** Get the signed-in user's activity feed
 * @param feed		type of feed, either "feed" or "news" (optional, defaults to "news")
 * @param filters	array of strings to filter by (optional, defaults to no filters)
 *					Allowed: PURCHASED, RATED, VIDEO_UPLOAD, SCREENSHOT_UPLOAD, PLAYED_GAME, STORE_PROMO, WATCHED_VIDEO, TROPHY, BROADCASTING, LIKED, PROFILE_PIC, FRIENDED and CONTENT_SHARE
 *					Use an empty array (or leave out argument) for all types
 * @param page 		Page of feed to load (default: 0)
 * @param callback	Callback function with error (false if no error) and returned data object
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

	// check filters are valid
	for(var i=0; i<filters.length; i++)
	{
		// remove filter if not in our valid list
		if (this.activityTypes.indexOf(filters[i]) == -1)
		{
			filters.splice(i, 1);
			i--;
		}
	}

	this.Get(
		"https://activity.api.np.km.playstation.net/activity/api/v1/users/{{psn}}/" + (feed == "feed" ? "feed" : "news") + "/" + parseInt(page),
		{
			filters: filters
		},
		callback
	);
}

/** Like an activity from the activity feed
 * @param storyId	The ID of the activity we want to like
 * @param dislike	(optional) set to true to dislike instead of like
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.likeActivity = function(storyId, dislike, callback)
{
	// support passing dislike manually into the function
	if (typeof dislike == "function")
	{
		callback = dislike;
		dislike = false;
	}

	this.Get(
		"https://activity.api.np.km.playstation.net/activity/api/v1/users/{{psn}}/set/" + (dislike ? "dis" : "") + "like/story/{{storyId}}".
		// tidy up passed in story ID - contains 42 lower-case hexadecimal chars in format: {8}-{4}-{4}-{4}-{12}
		replace("{{storyId}}", storyId.replace(/[^a-z0-9\-]/g, "")),
		{},
		callback
	);
}

/** Dislike an activity from the activity feed
 * @param storyId	The ID of the activity we want to dislike
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.dislikeActivity = function(storyId, callback)
{
	// just call like with dislike set to true
	this.likeActivity(storyId, true, callback);
}

// return our new psn request object with our new helper functions
module.exports = PSNRequest;