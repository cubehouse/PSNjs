PSNjs
=========

##About

This is a simple Node.JS API for accessing PSN data.

This is heavily based on work by psnapi.org and gumer-psn.

Note: v0.1.x is a completely new API that is incompatible with 0.0.x. Please take care when writing your dependancies.

##Installing

You can install it with the package manager

		npm install PSNjs
		
Or clone the repository and install the dependencies

		git clone https://github.com/cubehouse/PSNjs.git
		cd PSNjs/
		npm install

##API Setup
```javascript
var PSNjs = require('PSNjs');

var psn = new PSNjs({
	// PSN email and password
	email: "PSNEMAIL",
	password: "PSNPASSWORD",
	// debug printing
	debug: true,
	// optionally store session tokens in a file to speed up future connection
	authfile: ".psnAuth"
});

// get the above user's trophies
psn.getUserTrophies(function(error, data) {
	// check for an error
	if (error)
	{
		console.log("Error fetching trophies: " + error);
		return;
	}

	// success! print out trophy data
	console.log(JSON.stringify(data, null, 2));
});
```

###Other Init variables
```javascript
{
	email: "PSNEMAIL", // your email
	password: "PSNPASSWORD", // your password
	debug: true, // enable debug logging?
	requestDebug: false, // enable the request library's debug output?
	autoconnect: false, // make a PSN request immediately (make sure you use onReady if you do this)
	authfile: ".psnAuth", // optionally store PSN session tokens in this file
	onReady: function() {
		// this function will be called when the API is ready (mainly used when autoconnect is true)
	}
}
```

##Custom Save and Load Callbacks

If you don't want to use the authfile option, you can manually write save/load functions. For example, using Redis or something instead of the filesystem.

```javascript
var psn = new PSNjs({
	// PSN email and password
	email: "PSNEMAIL",
	password: "PSNPASSWORD"
});

// load example (data should be a Base64 string)
psn.Load("SAVED DATA", function(error) {
	if (error)
	{
		console.log("Error loading data: " + error);
		return;
	}

	// load successful!
});

// save example
psn.OnSave(function(data, callback) {
	// save data
	// data will be a Base64 string
	mySaveSystem.save(data, function() {
		// all done!
		// always call the callback so the API knows you're done saving!
		//  handle your own error reporting and debugging
		callback();
	});
});
```

Functions
=========

## getProfile(username, callback)

Get a PSN user's profile
 * username	- PSN username to request
 * callback	- Callback function with error (false if no error) and returned data object

## getMessageGroups(callback)

Get current user's message groups
 * callback - Callback function with error (false if no error) and returned data object


## getMessageContent(messageGroupId, messageUid, messageKind, callback)

Get data from a specific message. All this data can be found in getMessageGroups
 * messageGroupId - Group ID requested message belongs to
 * messageUid - Message ID to fetch
 * messageKind - Kind of message (as int)
 * callback - Callback function with error (false if no error) and returned data object

## getLatestActivity(feed, filters, page, callback)

Get the signed-in user's activity feed
 * feed - type of feed, either "feed" or "news" (optional, defaults to "news")
 * filters - array of strings to filter by (optional, defaults to no filters)
    * PURCHASE, RATED, PLAYED_WITH, VIDEO_UPLOAD, SCREENSHOT_UPLOAD, PLAYED_GAME, LAUNCHED_GAME_FIRST_TIME, WATCHED_VIDEO, TROPHY, BROADCASTING, LIKED, PROFILE_ABOUT_ME, PROFILE_PIC, FRIENDED, CONTENT_SHARE, STORE_PROMO, IN_GAME_POST,
    * Use an empty array (or leave out argument) for all types
 * page - Page of feed to load (default: 0)
 * callback - Callback function with error (false if no error) and returned data object

## likeActivity(storyId, dislike, callback)

Like an activity from the activity feed
 * storyId - The ID of the activity we want to like
 * dislike - (optional) set to true to dislike instead of like
 * callback - Callback function with error (false if no error) and returned data object

## dislikeActivity(storyId, callback)

Dislike an activity from the activity feed
 * storyId - The ID of the activity we want to dislike
 * callback - Callback function with error (false if no error) and returned data object

## getNotifications(callback)

Get notifications of currently authenticated user
 * callback - Callback function with error (false if no error) and returned data object

## addFriend(username, callback)

Add a friend to PSN (must have received a friend request from the user)
 * username - Username to add
 * callback - Callback function with error (false if no error) and returned data object

## removeFriend(username, callback)

Remove a friend from PSN
 * username	Username to remove
 * callback - Callback function with error (false if no error) and returned data object

## sendFriendRequest(username, message, callback)

Send a friend request to a user
 * username - Username to add
 * message - Message to send to user
 * callback - Callback function with error (false if no error) and returned data object

## getFriends(offset, limit, friendType, callback)

Get the user's friend list
 * offset - (optional) Index to start friend list
 * limit - (optional) Maximum limit of friends to fetch
 * friendType - (optional) Type of friends to filter by (accepts friend, requesting or requested)
 * callback - Callback function with error (false if no error) and returned data object

## generateFriendURL(callback)

Generate a friend URL you can give to people to add you as a friend.
 * callback - Callback function with error (false if no error) and returned data object

## getUserTrophies(offset, limit, username, callback)

Fetch trophy data for the logged in user (and optionally compare to another user)
 * offset - (optional) Starting index of trophy data
 * limit - (optional) Maximum number of titles to fetch
 * username - (optional) PSN ID to compare trophies with
 * callback - Callback function with error (false if no error) and returned data object

## getTrophyGroups(npCommunicationId, username, callback)

Get list of trophy groups for a title (eg. base game + DLC packs)
 * npCommunicationId - Title ID
 * Username - (optional) Username to compare trophies to
 * callback - Callback function with error (false if no error) and returned data object

## getTrophies(npCommunicationId, trophyGroupId, username, callback)

Get a title's trophies (supplying a trophy group), optionally comparing to another user.
 * npCommunicationId - Title ID
 * trophyGroupId - Trophy Group ID (from getTrophyGroups)
 * Username - (optional) Username to compare trophies to
 * callback - Callback function with error (false if no error) and returned data object

## getTrophy(npCommunicationId, trophyGroupId, trophyId, username, callback)

Get data on a specific trophy in a title with supplied trophyId. Optionally compare to a username.
 * npCommunicationId - Title ID
 * trophyGroupId - Trophy Group ID (from getTrophyGroups)
 * trophyId - Trophy ID
 * Username - (optional) Username to compare trophies to
 * callback - Callback function with error (false if no error) and returned data object



