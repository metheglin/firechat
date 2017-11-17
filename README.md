# Firechat [![Version](https://badge.fury.io/gh/firebase%2Ffirechat.svg)](http://badge.fury.io/gh/firebase%2Ffirechat)

Firechat is a simple, extensible chat widget powered by
[Firebase](https://firebase.google.com/?utm_source=firechat). It is intended to serve as a concise,
documented foundation for chat products built on Firebase. It works out of the box, and is easily
extended.

## Live Demo

Visit [firechat.firebaseapp.com](https://firechat.firebaseapp.com/) to see a live demo of Firechat.

[![A screenshot of Jenny and Lexi the cat chatting on the Firechat demo](screenshot.png)](https://firechat.firebaseapp.com/)

## Setup

Firechat uses the [Firebase Realtime Database](https://firebase.google.com/docs/database/?utm_source=firechat)
as a backend, so it requires no server-side code. It can be added to any web app by including a few
JavaScript files:

```HTML
<!-- jQuery -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js"></script>

<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/3.3.0/firebase.js"></script>

<!-- Firechat -->
<link rel="stylesheet" href="https://cdn.firebase.com/libs/firechat/3.0.1/firechat.min.css" />
<script src="https://cdn.firebase.com/libs/firechat/3.0.1/firechat.min.js"></script>
```

giving your users a way to authenticate:

```HTML
<script>
  function login() {
    // Log the user in via Twitter
    var provider = new firebase.auth.TwitterAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(function(error) {
      console.log("Error authenticating user:", error);
    });
  }

  firebase.auth().onAuthStateChanged(function(user) {
    // Once authenticated, instantiate Firechat with the logged in user
    if (user) {
      initChat(user);
    }
  });
</script>

<button onclick="login()">Login with Twitter</button>
```

and initializing the chat:

```HTML
<script>
  function initChat(user) {
    // Get a Firebase Database ref
    var chatRef = firebase.database().ref("chat");

    // Create a Firechat instance
    var chat = new FirechatUI(chatRef, document.getElementById("firechat-wrapper"));

    // Set the Firechat user
    chat.setUser(user.uid, user.displayName);
  }
</script>

<div id="firechat-wrapper"></div>
```

For detailed integration instructions, see the [Firechat documentation](https://firechat.firebaseapp.com/docs/).

## Getting Started with Firebase

Firechat requires Firebase in order to authenticate users and store data. You can
[sign up here](https://console.firebase.google.com/?utm_source=firechat) for a free account.

## Getting Help

If you have a question about Firechat, feel free to reach out through one of our
[official support channels](https://firebase.google.com/support/?utm_source=firechat).

## Required Setup

```js
var config = {
  apiKey: "***",
  authDomain: "***.firebaseio.com",
  databaseURL: "https://***.firebaseio.com/",
  storageBucket: "***.appspot.com",
}
firebase.initializeApp(config)
```

## Customize

```js
var chatRef = firebase.database().ref("chat");
var chat = new Man2ManChatUI(chatRef, document.getElementById("firechat-wrapper"));
```

### Customizing File Uploading Target

As default it uploads files to firebase storage, so you have to specify `storageBucket` in config at initializing firebase.
However, it also supports custom file upload target. You can write original file uploading along with the Dropzone style. After a file uploaded, you should call `uploadCallback` which posts the fileUrl to a firebase chat message.

```js
chat.setDropzoneConfig(function(roomId, roomName, uploadCallback) {
return {
  url: "/upload",
  maxFilesize: 20, // MB
  accept: function(file, done) {
    setTimeout(function(){
      return uploadCallback( "https://i.ytimg.com/vi/SNggmeilXDQ/maxresdefault.jpg" );
    }, 2000)
  }
};
```

### Customizing RoomType Tab

```
var chat = new Man2ManChatUI(
  chatRef, 
  document.getElementById("firechat-wrapper"),
  {
    "room_type_config": {
      "all": {
        "id": "all",
        "title": "ALL",
        "template_name": 'room-list-item',
        "appendee_id": 'firechat-all-room-list',
        "tab_id": 'tab-firechat-all-room-list',
        "active": false,
        "show_count": false
      }
    }
  }
);
```

```
$(document).on('click', '.search', function(){
  $.ajax({
    url: "/room_search",
  })
  .done(function( rooms ) {
    // roomsObj supposed to be like this:
    // {
    //   "roomid1": {
    //     name: "abcdefg",
    //     avatar: "https://github.com/fluidicon.png",
    //   },
    //   "roomid2": {
    //     name: "metheglin",
    //     avatar: "https://github.com/fluidicon.png",
    //   },
    //   "roomid3": {
    //     name: "jjjj",
    //     avatar: "https://github.com/fluidicon.png",
    //   },
    // }
    var roomsObj = rooms.reduce((acc,room)=>{
      acc[room.id] = room
      return acc
    }, {})

    chat.loadRoomList( "all", roomsObj, "replace");
  });
})
```

### Customizing File Downloader

```
var chat = new Man2ManChatUI(
  chatRef, 
  document.getElementById("firechat-wrapper"),
  {
    "file_downloadable": false,
  }
);
```
