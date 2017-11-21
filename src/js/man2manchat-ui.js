(function($) {

  var dam = new LastDamGate( /*fps=*/0.6 );

  if (!$ || (parseInt($().jquery.replace(/\./g, ""), 10) < 170)) {
    throw new Error("jQuery 1.7 or later required!");
  }

  var root = this,
      previousMan2ManChatUI = root.Man2ManChatUI;

  root.Man2ManChatUI = Man2ManChatUI;

  if (!self.FirechatDefaultTemplates) {
    throw new Error("Unable to find chat templates!");
  }

  function Man2ManChatUI(firebaseRef, el, options) {
    var self = this;

    if (!firebaseRef) {
      throw new Error('Man2ManChatUI: Missing required argument `firebaseRef`');
    }

    if (!el) {
      throw new Error('Man2ManChatUI: Missing required argument `el`');
    }

    options = options || {};
    this._options = options;

    this._el = el;
    this._user = null;
    this._chat = new Firechat(firebaseRef, options);

    // A list of rooms to enter once we've made room for them (once we've hit the max room limit).
    this._roomQueue = [];

    // Define some constants regarding maximum lengths, client-enforced.
    this.maxLengthUsername = 15;
    this.maxLengthUsernameDisplay = 15;
    this.maxLengthRoomName = 24;
    this.maxLengthMessage = 1500;
    this.maxUserSearchResults = 100;

    // Define some useful regexes.
    this.urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;
    this.pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
    this._meAvatar = this._options.me_avatar || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
    this._othersAvatar = this._options.others_avatar || 'http://www.murketing.com/journal/wp-content/uploads/2009/04/yammer.gif';

    this._sendCallback = undefined;
    this._dropzoneConfig = function(roomId, roomName, uploadCallback) {
      return {
        url: "/upload",
        maxFilesize: 20, // MB
        clickable: "#uploader",
        accept: function(file, done) {
          console.log("uploaded file", file);
          if ( file ) {
            var fileNamePrefix = new Date().getTime()+Math.random().toString(36).substring(2, 10);
            var filepath = 'images/' + fileNamePrefix + "_" + file.name;
            var storageRef = firebase.storage().ref(filepath);
            var task = storageRef.put(file);

            task.on('state_changed',
              function progress(snapshot){},
              function error(err){
                alert('Something wrong with uploading. Please confirm the file less then 20MB.');
              },
              function complete(snapshot){
                return uploadCallback( task.snapshot.downloadURL );
              }
            );
          }
        }
      };
    };
    this._roomTypeConfig = Object.assign({
      // "default": {
      //   "id": "default",
      //   "title": "Recent"
      // },
      "unread": {
        "id": "unread",
        "title": "未読",
        "template_name": 'room-list-item',
        "active": true,
        "show_count": true
      }
    }, this._options.room_type_config);

    this._renderLayout();

    // Grab shortcuts to commonly used jQuery elements.
    this.$wrapper = $('#firechat');
    this.$roomList = $('#firechat-room-list');
    this.$unreadRoomList = $('#firechat-unread-room-list');
    this.$tabList = $('#firechat-tab-list');
    this.$tabContent = $('#firechat-tab-content');
    this.$messages = {};

    // Rate limit messages from a given user with some defaults.
    this.$rateLimit = {
      limitCount: 10,         // max number of events
      limitInterval: 10000,   // max interval for above count in milliseconds
      limitWaitTime: 30000,   // wait time if a user hits the wait limit
      history: {}
    };

    if ("send_options" in this._options) {
      this._options.send_options.enter = this._options.send_options.enter || false;
      this._options.send_options.click = this._options.send_options.click || false;
    }else{
      this._options.send_options = {"enter": true, "click": false};
    }
    // Setup UI bindings for chat controls.
    this._bindUIEvents();

    // Setup bindings to internal methods
    this._bindDataEvents();
  }

  // Run Man2ManChatUI in *noConflict* mode, returning the `Man2ManChatUI` variable to
  // its previous owner, and returning a reference to the Man2ManChatUI object.
  Man2ManChatUI.noConflict = function noConflict() {
    root.Man2ManChatUI = previousMan2ManChatUI;
    return Man2ManChatUI;
  };

  Man2ManChatUI.prototype = {

    _bindUIEvents: function() {
      // Chat-specific custom interactions and functionality.
      this._bindForHeightChange();
      this._bindForTabControls();
      this._bindForRoomList();
      this._bindForUnreadRoomList();
      this._bindForUserRoomList();
      this._bindForUserSearch();
      // this._bindForUserMuting();

      // Generic, non-chat-specific interactive elements.
      this._setupTabs();
      this._setupDropdowns();
      this._bindTextInputFieldLimits();
    },

    _bindDataEvents: function() {
      this._chat.on('user-update', this._onUpdateUser.bind(this));

      // Bind events for new messages, enter / leaving rooms, and user metadata.
      this._chat.on('room-enter', this._onEnterRoom.bind(this));
      this._chat.on('room-exit', this._onLeaveRoom.bind(this));
      this._chat.on('message-add', this._onNewMessage.bind(this));
      this._chat.on('message-remove', this._onRemoveMessage.bind(this));

      // Bind events related to chat invitations.
      // this._chat.on('room-invite', this._onChatInvite.bind(this));
      // this._chat.on('room-invite-response', this._onChatInviteResponse.bind(this));

      // Binds events related to admin or moderator notifications.
      this._chat.on('notification', this._onNotification.bind(this));
    },

    _renderLayout: function() {
      var self = this;
      var template = FirechatDefaultTemplates["templates/layout-full.html"];
      $(this._el).html(template({
        maxLengthUsername: this.maxLengthUsername,
        roomTypeConfig: Object.keys(this._roomTypeConfig).map(function(key){
          return self.roomType(key);
        })
      }));
    },

    _onUpdateUser: function(user) {
      // Update our current user state and render latest user name.
      this._user = user;

      // Update our interface to reflect which users are muted or not.
      var mutedUsers = this._user.muted || {};
      $('[data-event="firechat-user-mute-toggle"]').each(function(i, el) {
        var userId = $(this).closest('[data-user-id]').data('user-id');
        $(this).toggleClass('red', !!mutedUsers[userId]);
      });

      // Ensure that all messages from muted users are removed.
      for (var userId in mutedUsers) {
        $('.message[data-user-id="' + userId + '"]').fadeOut();
      }
    },

    _onEnterRoom: function(room) {
      this.attachTab(room.id, room.name, room.avatar);
    },
    _onLeaveRoom: function(roomId) {
      this.removeTab(roomId);

      // Auto-enter rooms in the queue
      if ((this._roomQueue.length > 0)) {
        this._chat.enterRoom(this._roomQueue.shift(roomId));
      }
    },
    _onNewMessage: function(roomId, message) {
      var self = this;
      var userId = message.userId;
      if (!this._user || !this._user.muted || !this._user.muted[userId]) {
        this.showMessage(roomId, message);
      }
    },
    _onRemoveMessage: function(roomId, messageId) {
      this.removeMessage(roomId, messageId);
    },

    // Events related to chat invitations.
    // _onChatInvite: function(invitation) {
    //   var self = this;
    //   var template = FirechatDefaultTemplates["templates/prompt-invitation.html"];
    //   var $prompt = this.prompt('Invite', template(invitation));
    //   $prompt.find('a.close').click(function() {
    //     $prompt.remove();
    //     self._chat.declineInvite(invitation.id);
    //     return false;
    //   });

    //   $prompt.find('[data-toggle=accept]').click(function() {
    //     $prompt.remove();
    //     self._chat.acceptInvite(invitation.id);
    //     return false;
    //   });

    //   $prompt.find('[data-toggle=decline]').click(function() {
    //     $prompt.remove();
    //     self._chat.declineInvite(invitation.id);
    //     return false;
    //   });
    // },
    // _onChatInviteResponse: function(invitation) {
    //   if (!invitation.status) return;

    //   var self = this,
    //       template = FirechatDefaultTemplates["templates/prompt-invite-reply.html"],
    //       $prompt;

    //   if (invitation.status && invitation.status === 'accepted') {
    //     $prompt = this.prompt('Accepted', template(invitation));
    //     this._chat.getRoom(invitation.roomId, function(room) {
    //       self.attachTab(invitation.roomId, room.name);
    //     });
    //   } else {
    //     $prompt = this.prompt('Declined', template(invitation));
    //   }

    //   $prompt.find('a.close').click(function() {
    //     $prompt.remove();
    //     return false;
    //   });
    // },

    // Events related to admin or moderator notifications.
    _onNotification: function(notification) {
      if (notification.notificationType === 'warning') {
        this.renderAlertPrompt('Warning', 'You are being warned for inappropriate messaging. Further violation may result in temporary or permanent ban of service.');
      } else if (notification.notificationType === 'suspension') {
        var suspendedUntil = notification.data.suspendedUntil,
            secondsLeft = Math.round((suspendedUntil - new Date().getTime()) / 1000),
            timeLeft = '';

        if (secondsLeft > 0) {
          if (secondsLeft > 2*3600) {
            var hours = Math.floor(secondsLeft / 3600);
            timeLeft = hours + ' hours, ';
            secondsLeft -= 3600*hours;
          }
          timeLeft += Math.floor(secondsLeft / 60) + ' minutes';
          this.renderAlertPrompt('Suspended', 'A moderator has suspended you for violating site rules. You cannot send messages for another ' + timeLeft + '.');
        }
      }
    }
  };

  /**
   * Initialize an authenticated session with a user id and name.
   * This method assumes that the underlying Firebase reference has
   * already been authenticated.
   */
  Man2ManChatUI.prototype.setUser = function(userId, userName, userAvatar, callback) {
    var self = this;

    // Initialize data events
    self._chat.setUser(userId, userName, userAvatar, function(user) {
      self._user = user;

      // if (self._chat.userIsModerator()) {
      //   self._bindSuperuserUIEvents();
      // }

      if ( callback ) {
        callback( self );
      } else {
        self._chat.resumeSession();
      }
    });
  };

  /**
   * Exposes internal chat bindings via this external interface.
   */
  Man2ManChatUI.prototype.on = function(eventType, cb) {
    var self = this;

    this._chat.on(eventType, cb);
  };

  /**
   * Binds a custom context menu to messages for superusers to warn or ban
   * users for violating terms of service.
   */
  // Man2ManChatUI.prototype._bindSuperuserUIEvents = function() {
  //   var self = this,
  //       parseMessageVars = function(event) {
  //         var $this = $(this),
  //         messageId = $this.closest('[data-message-id]').data('message-id'),
  //         userId = $('[data-message-id="' + messageId + '"]').closest('[data-user-id]').data('user-id'),
  //         roomId = $('[data-message-id="' + messageId + '"]').closest('[data-room-id]').data('room-id');

  //         return { messageId: messageId, userId: userId, roomId: roomId };
  //       },
  //       clearMessageContextMenus = function() {
  //         // Remove any context menus currently showing.
  //         $('[data-toggle="firechat-contextmenu"]').each(function() {
  //           $(this).remove();
  //         });

  //         // Remove any messages currently highlighted.
  //         $('#firechat .message.highlighted').each(function() {
  //           $(this).removeClass('highlighted');
  //         });
  //       },
  //       showMessageContextMenu = function(event) {
  //         var $this = $(this),
  //             $message = $this.closest('[data-message-id]'),
  //             template = FirechatDefaultTemplates["templates/message-context-menu.html"],
  //             messageVars = parseMessageVars.call(this, event),
  //             $template;

  //         event.preventDefault();

  //         // Clear existing menus.
  //         clearMessageContextMenus();

  //         // Highlight the relevant message.
  //         $this.addClass('highlighted');

  //         self._chat.getRoom(messageVars.roomId, function(room) {
  //           // Show the context menu.
  //           $template = $(template({
  //             id: $message.data('message-id')
  //           }));
  //           $template.css({
  //             left: event.clientX,
  //             top: event.clientY
  //           }).appendTo(self.$wrapper);
  //         });
  //       };

  //   // Handle dismissal of message context menus (any non-right-click click event).
  //   $(document).bind('click', { self: this }, function(event) {
  //     if (!event.button || event.button != 2) {
  //       clearMessageContextMenus();
  //     }
  //   });

  //   // Handle display of message context menus (via right-click on a message).
  //   $(document).delegate('[data-class="firechat-message"]', 'contextmenu', showMessageContextMenu);

  //   // Handle click of the 'Warn User' contextmenu item.
  //   $(document).delegate('[data-event="firechat-user-warn"]', 'click', function(event) {
  //     var messageVars = parseMessageVars.call(this, event);
  //     self._chat.warnUser(messageVars.userId);
  //   });

  //   // Handle click of the 'Suspend User (1 Hour)' contextmenu item.
  //   $(document).delegate('[data-event="firechat-user-suspend-hour"]', 'click', function(event) {
  //     var messageVars = parseMessageVars.call(this, event);
  //     self._chat.suspendUser(messageVars.userId, /* 1 Hour = 3600s */ 60*60);
  //   });

  //   // Handle click of the 'Suspend User (1 Day)' contextmenu item.
  //   $(document).delegate('[data-event="firechat-user-suspend-day"]', 'click', function(event) {
  //     var messageVars = parseMessageVars.call(this, event);
  //     self._chat.suspendUser(messageVars.userId, /* 1 Day = 86400s */ 24*60*60);
  //   });

  //   // Handle click of the 'Delete Message' contextmenu item.
  //   $(document).delegate('[data-event="firechat-message-delete"]', 'click', function(event) {
  //     var messageVars = parseMessageVars.call(this, event);
  //     self._chat.deleteMessage(messageVars.roomId, messageVars.messageId);
  //   });
  // };

  /**
   * Binds to height changes in the surrounding div.
   */
  Man2ManChatUI.prototype._bindForHeightChange = function() {
    var self = this,
        $el = $(this._el),
        lastHeight = null;

    setInterval(function() {
      var height = $el.height();
      if (height != lastHeight) {
        lastHeight = height;
        $('.chat').each(function(i, el) {

        });
      }
    }, 500);
  };

  /**
   * Binds custom inner-tab events.
   */
  Man2ManChatUI.prototype._bindForTabControls = function() {
    var self = this;

    // Handle click of tab close button.
    $(document).delegate('[data-event="firechat-close-tab"]', 'click', function(event) {
      var roomId = $(this).closest('[data-room-id]').data('room-id');
      self._chat.leaveRoom(roomId);
      return false;
    });
  };

  Man2ManChatUI.prototype._bindForRoomList = function() {
    var self = this;

    // var template = FirechatDefaultTemplates["templates/room-list-item.html"],
    //     selectRoomListItem = function() {
    //       var parent = $(this).parent(),
    //           roomId = parent.data('room-id'),
    //           roomName = parent.data('room-name');

    //       if (self.$messages[roomId]) {
    //         self.focusTab(roomId);
    //       } else {
    //         self._chat.enterRoom(roomId, roomName);
    //       }
    //       return false;
    //     };

    // self._chat.getRoomList(function(rooms) {
    //   self.$roomList.empty();
    //   for (var roomId in rooms) {
    //     var room = rooms[roomId];
    //     if (room.type != "public") continue;
    //     room.isRoomOpen = !!self.$messages[room.id];
    //     room.avatar = room.avatar ? room.avatar : self._defaultAvatar;
    //     var $roomItem = $(template(room));
    //     $roomItem.children('a').bind('click', selectRoomListItem);
    //     self.$roomList.append($roomItem.toggle(true));
    //   }
    // });
  };

  Man2ManChatUI.prototype.roomType = function( roomType ) {
    var self = this;
    var conf = self._roomTypeConfig[roomType];

    var tab_id      = conf.tab_id || 'tab-firechat-' + conf.id + '-room-list';
    var tabpanel_id = conf.tabpanel_id || 'tabpanel-firechat-' + conf.id + '-room-list';
    var appendee_id = conf.appendee_id || 'appendee-firechat-' + conf.id + '-room-list';
    var template    = conf.template || FirechatDefaultTemplates["templates/" + conf.template_name + ".html"];

    return Object.assign({}, conf, {
      template:           template,
      tab_id:             tab_id,
      tab_selector:       '#' + tab_id,
      tab:                $('#' + tab_id),
      tabpanel_id:        tabpanel_id,
      tabpanel_selector:  '#' + tabpanel_id,
      tabpanel:           $('#' + tabpanel_id),
      appendee_id:        appendee_id,
      appendee_selector:  '#' + appendee_id,
      appendee:           $('#' + appendee_id)
    });
  };

  // Man2ManChatUI.prototype.setRoomType = function( roomType, config ) {
  //   var self = this;
  //   self._roomTypeConfig[roomType] = config;
  // };

  /**
   * Return this format of object
   * {
   *   id: xxx,
   *   type: "public",
   *   name: xxx,
   *   isRoomOpen: false,
   *   avatar: xxx,
   *   ...
   * }
   */
  Man2ManChatUI.prototype.normalizeRoom = function( roomId, room ) {
    var self = this;
    return {
      id: roomId,
      type: "public",
      name: room.name ? room.name : "不明のチャット",
      isRoomOpen: false,
      avatar: room.avatar ? room.avatar : self._othersAvatar,
      roommeta: {
        name: room.name ? room.name : "不明のチャット"
      }
    };
  };

  Man2ManChatUI.prototype.appendRoom = function( roomType, normalizedRoom ) {
    var self = this;
    var $roomItem = self.makeRoomItem( roomType, normalizedRoom );
    self.appendRoomItem( roomType, $roomItem );
  };

  Man2ManChatUI.prototype.makeRoomItem = function( roomType, normalizedRoom ) {
    var self = this;
    var roomTypeConfig = self.roomType(roomType);
    var $roomItem = $(roomTypeConfig.template(normalizedRoom));
    return $roomItem;
  };

  Man2ManChatUI.prototype.appendRoomItem = function( roomType, $roomItem ) {
    var self = this;
    var roomTypeConfig = self.roomType(roomType);
    roomTypeConfig.appendee.append($roomItem.toggle(true));
  };

  Man2ManChatUI.prototype.setRoomItemCount = function( roomType ) {
    var self = this;
    var roomTypeConfig = self.roomType(roomType);
    $(roomTypeConfig.tab_selector + " .chat_count").text($(roomTypeConfig.appendee_selector + " li").length);
  };

  Man2ManChatUI.prototype.beforeLoadRoomList = function( data ) {
    var self = this;
    var roomType = data.roomType, rooms = data.rooms, loadType = data.loadType;
    var roomTypeConfig = self.roomType(roomType);
    if ( loadType === "replace" ) {
      roomTypeConfig.appendee.empty();
    }
    return new Promise(function(resolve, reject){
      resolve(data);
    });
  };

  Man2ManChatUI.prototype.executeLoadRoomList = function( data ) {
    var self = this;
    var roomType = data.roomType, rooms = data.rooms, loadType = data.loadType;

    return new Promise(function(resolve, reject){
      for ( var roomId in rooms ) {
        var room = self.normalizeRoom( roomId, rooms[roomId] );
        if (room.type != "public") continue;
        self.appendRoom( roomType, room );
        // var $roomItem = self.makeRoomItem( roomType, room );
        // self.appendRoomItem( roomType, $roomItem );
      }
      resolve(data);
    });
  };

  Man2ManChatUI.prototype.afterLoadRoomList = function( data ) {
    var self = this;
    var roomType = data.roomType, rooms = data.rooms, loadType = data.loadType;

    return new Promise(function(resolve, reject){
      self.setRoomItemCount(roomType);
      resolve(data);
    });
  };

  /**
   * loadType: "replace", "append"
   */
  Man2ManChatUI.prototype.loadRoomList = function( roomType, rooms, loadType ) {
    var self = this;
    var roomTypeConfig = self.roomType(roomType);
    loadType = loadType || "replace";

    // if ( loadType === "replace" ) {
    //   roomTypeConfig.appendee.empty();
    // }

    var data = {
      roomType: roomType, 
      rooms: rooms, 
      loadType: loadType
    };
    self.beforeLoadRoomList( data ).then(function(data){
      return self.executeLoadRoomList(data);
    }).then(function(data){
      return self.afterLoadRoomList(data);
    });
  };

  Man2ManChatUI.prototype._bindForUnreadRoomList = function() {
    var self = this;
    
    self._chat.getUnreadRoomList(function(rooms) {
      self.loadRoomList( "unread", rooms, "replace" );
    });
  };

  Man2ManChatUI.prototype.selectUserRoom = function(roomId, roomName) {
    var self = this;
    if (self.$messages[roomId]) {
      self.focusTab(roomId);
    } else {
      self._chat.enterRoom(roomId, roomName);
    }
  };

  /**
   * Binds user list dropdown per room to populate user list on-demand.
   */
  Man2ManChatUI.prototype._bindForUserRoomList = function() {
    var self = this;

    // Upon click of the dropdown, autofocus the input field and trigger list population.
    $(document).delegate('[data-event="firechat-user-room-list-btn"]', 'click', function(event) {
      event.stopPropagation();

      var $this = $(this),
          roomId = $this.closest('[data-room-id]').data('room-id'),
          template = FirechatDefaultTemplates["templates/room-user-list-item.html"],
          targetId = $this.data('target'),
          $target = $('#' + targetId);

      $target.empty();
      self._chat.getUsersByRoom(roomId, function(users) {
        for (var username in users) {
          user = users[username];
          // user.disableActions = (!self._user || user.id === self._user.id);
          user.disableActions = true;
          user.nameTrimmed = self.trimWithEllipsis(user.name, self.maxLengthUsernameDisplay);
          user.isMuted = (self._user && self._user.muted && self._user.muted[user.id]);
          $target.append($(template(user)));
        }
        self.sortListLexicographically('#' + targetId);
      });
    });
  };

  /**
   * Binds user search buttons, dropdowns, and input fields for searching all
   * active users currently in chat.
   */
  Man2ManChatUI.prototype._bindForUserSearch = function() {
    var self = this,
        handleUserSearchSubmit = function(event) {
          var $this = $(this),
              targetId = $this.data('target'),
              controlsId = $this.data('controls'),
              templateId = $this.data('template'),
              prefix = $this.val() || $this.data('prefix') || '',
              startAt = $this.data('startAt') || null,
              endAt = $this.data('endAt') || null;

          event.preventDefault();

          userSearch(targetId, templateId, controlsId, prefix, startAt, endAt);
        },
        userSearch = function(targetId, templateId, controlsId, prefix, startAt, endAt) {
          var $target = $('#' + targetId),
              $controls = $('#' + controlsId),
              template = FirechatDefaultTemplates[templateId];

          // Query results, filtered by prefix, using the defined startAt and endAt markets.
          self._chat.getUsersByPrefix(prefix, startAt, endAt, self.maxUserSearchResults, function(users) {
            var numResults = 0,
                $prevBtn, $nextBtn, username, firstResult, lastResult;

            $target.empty();

            for (username in users) {
              var user = users[username];

              // Disable buttons for <me>.
              // user.disableActions = (!self._user || user.id === self._user.id);
              user.disableActions = true;

              numResults += 1;

              $target.append(template(user));

              // If we've hit our result limit, the additional value signifies we should paginate.
              if (numResults === 1) {
                firstResult = user.name.toLowerCase();
              } else if (numResults >= self.maxUserSearchResults) {
                lastResult = user.name.toLowerCase();
                break;
              }
            }

            if ($controls) {
              $prevBtn = $controls.find('[data-toggle="firechat-pagination-prev"]');
              $nextBtn = $controls.find('[data-toggle="firechat-pagination-next"]');

              // Sort out configuration for the 'next' button
              if (lastResult) {
                $nextBtn
                  .data('event', 'firechat-user-search')
                  .data('startAt', lastResult)
                  .data('prefix', prefix)
                  .removeClass('disabled').removeAttr('disabled');
              } else {
                $nextBtn
                  .data('event', null)
                  .data('startAt', null)
                  .data('prefix', null)
                  .addClass('disabled').attr('disabled', 'disabled');
              }
            }
          });
        };

    $(document).delegate('[data-event="firechat-user-search"]', 'keyup', handleUserSearchSubmit);
    $(document).delegate('[data-event="firechat-user-search"]', 'click', handleUserSearchSubmit);

    // Upon click of the dropdown, autofocus the input field and trigger list population.
    $(document).delegate('[data-event="firechat-user-search-btn"]', 'click', function(event) {
      event.stopPropagation();
      var $input = $(this).next('div.firechat-dropdown-menu').find('input');
      $input.focus();
      $input.trigger(jQuery.Event('keyup'));
    });

    // Ensure that the dropdown stays open despite clicking on the input element.
    $(document).delegate('[data-event="firechat-user-search"]', 'click', function(event) {
      event.stopPropagation();
    });
  };

  /**
   * Binds user mute toggles and removes all messages for a given user upon mute.
   */
  // Man2ManChatUI.prototype._bindForUserMuting = function() {
  //   var self = this;
  //   $(document).delegate('[data-event="firechat-user-mute-toggle"]', 'click', function(event) {
  //     var $this = $(this),
  //         userId = $this.closest('[data-user-id]').data('user-id'),
  //         userName = $this.closest('[data-user-name]').data('user-name'),
  //         isMuted = $this.hasClass('red'),
  //         template = FirechatDefaultTemplates["templates/prompt-user-mute.html"];

  //     event.preventDefault();

  //     // Require user confirmation for muting.
  //     if (!isMuted) {
  //       var $prompt = self.prompt('Mute User?', template({
  //         userName: userName
  //       }));

  //       $prompt.find('a.close').first().click(function() {
  //         $prompt.remove();
  //         return false;
  //       });

  //       $prompt.find('[data-toggle=decline]').first().click(function() {
  //         $prompt.remove();
  //         return false;
  //       });

  //       $prompt.find('[data-toggle=accept]').first().click(function() {
  //         self._chat.toggleUserMute(userId);
  //         $prompt.remove();
  //         return false;
  //       });
  //     } else {
  //       self._chat.toggleUserMute(userId);
  //     }
  //   });
  // };

  Man2ManChatUI.prototype.onOpenRoom = function( roomId ) {
    var self = this;
    // console.log("Room Opened.", roomId);
  };

  /**
   * A stripped-down version of bootstrap-tab.js.
   *
   * Original bootstrap-tab.js Copyright 2012 Twitter, Inc.,licensed under the Apache v2.0
   */
  Man2ManChatUI.prototype._setupTabs = function() {
    var self = this,
        show = function($el) {
          var $this = $el,
              $ul = $this.closest('ul:not(.firechat-dropdown-menu)'),
              selector = $this.attr('data-target'),
              previous = $ul.find('.active:last a')[0],
              $target,
              e;

          if (!selector) {
            selector = $this.attr('href');
            selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '');
          }

          if ($this.parent('li').hasClass('active')) return;

          e = $.Event('show', { relatedTarget: previous });

          $this.trigger(e);

          if (e.isDefaultPrevented()) return;

          $target = $(selector);

          if ( $target.length <= 0 ) {
            var roomId = selector.replace('#', '');
            var roomName = $el.parent().data("roomName");
            console.log("Loading new room...", roomId, roomName);
            self.selectUserRoom(roomId, roomName);
            return;
          }

          activate($this.parent('li'), $ul);
          activate($target, $target.parent(), function () {
            $this.trigger({
              type: 'shown',
              relatedTarget: previous
            });
          });
          showDetail($el);
        },
        activate = function (element, container, callback) {
          var $active = container.find('> .active'),
              transition = callback && $.support.transition && $active.hasClass('fade');

          function next() {
            $active
              .removeClass('active')
              .find('> .firechat-dropdown-menu > .active')
              .removeClass('active');

            element.addClass('active');

            if (transition) {
              element.addClass('in');
            } else {
              element.removeClass('fade');
            }

            if (element.parent('.firechat-dropdown-menu')) {
              element.closest('li.firechat-dropdown').addClass('active');
            }

            if (callback) {
              callback();
            }
          }

          if (transition) {
            $active.one($.support.transition.end, next);
          } else {
            next();
          }

          $active.removeClass('in');
      },
      showDetail = function($el){
        var $this = $el;
            
        var roomData = $this.parent().data();
        var normalizedData = self.normalizeRoomDetailData(roomData);
        self.renderRoomDetail(normalizedData);
      };

    $(document).delegate('[data-toggle="firechat-tab"]', 'click', function(event) {
      event.preventDefault();
      show($(this));
      self.onOpenRoom( $(this).parent().data("roomId") );
    });
  };

  Man2ManChatUI.prototype.normalizeRoomDetailData = function( roomData ) {
    var self = this;
    var roomMeta = Object.keys(roomData).reduce(function(acc,key){
      if ( key.match(/^roommeta/) ) {
        var shortkey = key.replace("roommeta", "");
        if ( shortkey !== "Avatar" ) {
          acc[shortkey] = roomData[key];
        }
      }
      return acc;
    }, {});

    return {
      avatar: roomData.roommetaAvatar ? roomData.roommetaAvatar : self._othersAvatar,
      roomMeta: roomMeta
    };
  };

  Man2ManChatUI.prototype.renderRoomDetail = function( normalizedData ) {
    var $imgAvatar = $("#chat_right").find(".roommeta-avatar");
    var $ulTable = $("#chat_right").find(".roommeta-table");
    
    $imgAvatar.attr("src", normalizedData.avatar);
    var roomMeta = normalizedData.roomMeta;
    var html = Object.keys(roomMeta).reduce(function(acc,key){
      if (!roomMeta[key]) return "";
      var template = FirechatDefaultTemplates["templates/detail-column.html"];
      return acc + template({key: key, value: roomMeta[key]});
    }, "");
    $ulTable.html(html);
  };

  /**
   * A stripped-down version of bootstrap-dropdown.js.
   *
   * Original bootstrap-dropdown.js Copyright 2012 Twitter, Inc., licensed under the Apache v2.0
   */
  Man2ManChatUI.prototype._setupDropdowns = function() {
    var self = this,
        toggle = '[data-toggle=firechat-dropdown]',
        toggleDropdown = function(event) {
          var $this = $(this),
              $parent = getParent($this),
              isActive = $parent.hasClass('open');

          if ($this.is('.disabled, :disabled')) return;

          clearMenus();

          if (!isActive) {
            $parent.toggleClass('open');
          }

          $this.focus();

          return false;
        },
        clearMenus = function() {
          $('[data-toggle=firechat-dropdown]').each(function() {
            getParent($(this)).removeClass('open');
          });
        },
        getParent = function($this) {
          var selector = $this.attr('data-target'),
              $parent;

          if (!selector) {
            selector = $this.attr('href');
            selector = selector && /#/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '');
          }

          $parent = selector && (selector !== '#') && $(selector);

          if (!$parent || !$parent.length) $parent = $this.parent();

          return $parent;
        };

      $(document)
        .bind('click', clearMenus)
        .delegate('.firechat-dropdown-menu', 'click', function(event) { event.stopPropagation(); })
        .delegate('[data-toggle=firechat-dropdown]', 'click', toggleDropdown);
  };

  /**
   * Binds to any text input fields with data-provide='limit' and
   * data-counter='<selector>', and upon value change updates the selector
   * content to reflect the number of characters remaining, as the 'maxlength'
   * attribute less the current value length.
   */
  Man2ManChatUI.prototype._bindTextInputFieldLimits = function() {
    $('body').delegate('input[data-provide="limit"], textarea[data-provide="limit"]', 'keyup', function(event) {
      var $this = $(this),
          $target = $($this.data('counter')),
          limit = $this.attr('maxlength'),
          count = $this.val().length;

      $target.html(Math.max(0, limit - count));
    });
  };

  /**
   * Given a title and message content, show an alert prompt to the user.
   *
   * @param    {string}    title
   * @param    {string}    message
   */
  Man2ManChatUI.prototype.renderAlertPrompt = function(title, message) {
    var template = FirechatDefaultTemplates["templates/prompt-alert.html"],
        $prompt = this.prompt(title, template({ message: message }));

      $prompt.find('.close').click(function() {
        $prompt.remove();
        return false;
      });
      return;
  };

  /**
   * Toggle input field s if we want limit / unlimit input fields.
   */
  Man2ManChatUI.prototype.toggleInputs = function(isEnabled) {
    $('#firechat-tab-content textarea').each(function() {
      var $this = $(this);
      if (isEnabled) {
        $(this).val('');
      } else {
        $(this).val('You have exceeded the message limit, please wait before sending.');
      }
      $this.prop('disabled', !isEnabled);
    });
    $('#firechat-input-name').prop('disabled', !isEnabled);
  };

  /**
   * Given a room id and name, attach the tab to the interface and setup events.
   *
   * @param    {string}    roomId
   * @param    {string}    roomName
   */
  Man2ManChatUI.prototype.attachTab = function(roomId, roomName, roomAvatar) {
    var self = this;

    // If this tab already exists, give it focus.
    if (this.$messages[roomId]) {
      this.focusTab(roomId);
      return;
    }

    // var room = {
    //   id: roomId,
    //   name: roomName,
    //   avatar: roomAvatar ? roomAvatar : self._defaultAvatar
    // };
    var room = self.normalizeRoom( roomId, {
      id: roomId,
      room_id: roomId,
      name: roomName,
      avatar: roomAvatar ? roomAvatar : self._othersAvatar
    });

    // Populate and render the tab content template.
    var tabTemplate = FirechatDefaultTemplates["templates/tab-content.html"];
    var $tabContent = $(tabTemplate(Object.assign({},room,{send_options: self._options.send_options})));
    this.$tabContent.prepend($tabContent);
    var $messages = $('#firechat-messages' + roomId);
    var $btnMarkRead = $("#btn-mark-read-" + roomId);

    // Keep a reference to the message listing for later use.
    this.$messages[roomId] = $messages;

    // Attach on-enter event to textarea.
    var $textarea = $tabContent.find('textarea').first();
    $textarea.bind('keydown', function(e) {
      self._chat.typingSignal(roomId);
      var message = self.trimWithEllipsis($textarea.val(), self.maxLengthMessage);
      if (self._options.send_options.enter && (e.which === 13) && (message !== '')) {
        if(!e.shiftKey){
          $textarea.val('');
          self._chat.sendMessage(roomId, message, null, self._sendCallback.bind(self, {
            roomId: roomId,
            roomName: roomName,
            message: message
          }));
          return false;
        }
      }
    });
    // on-click event to send button.
    if(self._options.send_options.click){
      $('#send_message').on('click', function(){
        var message = self.trimWithEllipsis($textarea.val(), self.maxLengthMessage);
        self._chat.sendMessage(roomId, message, null, self._sendCallback.bind(self, {
          roomId: roomId,
          roomName: roomName,
          message: message
        }));
        $textarea.val('');
        return false;
      });
    }

    // Initialize Image Uploader
    var myDropzone = new Dropzone("#panel-message", self._dropzoneConfig(roomId, roomName, function( url ) {
      var imageExtensions = ["gif","jpeg","jpg","png","tif","tiff","bmp"];
      var attachmentExtension = url.split('?').shift().split('.').pop();
      var attachmentType = (imageExtensions.indexOf(attachmentExtension) > -1) ? "image" : "file";

      self._chat.sendAttachment(roomId, url, attachmentType, self._sendCallback.bind(self, {
        roomId: roomId,
        roomName: roomName,
        message: null
      }));
    }));

    // Populate and render the tab menu template.
    var tabListTemplate = FirechatDefaultTemplates["templates/tab-menu-item.html"];
    var $tab = $(tabListTemplate(room));
    this.$tabList.prepend($tab);

    // Attach on-shown event to move tab to front and scroll to bottom.
    $tab.bind('shown', function(event) {
      $messages.scrollTop($messages[0].scrollHeight);
      
      $btnMarkRead.on("click", function(){
        console.log("marked as READ:", roomId);
        self.doMarkAsRead( roomId );
      });
    });

    // Dynamically update the width of each tab based upon the number open.
    var tabs = this.$tabList.children('li');
    // var tabWidth = Math.floor($('#firechat-tab-list').width() / tabs.length);
    // this.$tabList.children('li').css('width', tabWidth);
    self._chat.getTypingSignal(roomId, function(id, data){
      $("#typingSignal").html("");
      $("#typingSignal").append("<small id='"+id+"'>"+data.name+" is Typing... </small>");
      setTimeout(function(){
        $("#typingSignal").find('#'+id).remove();
      }, 1000);
    });

    // Update the room listing to reflect that we're now in the room.
    this.$roomList.children('[data-room-id=' + roomId + ']').children('a').addClass('highlight');

    // Sort each item in the user list alphabetically on click of the dropdown.
    $('#firechat-btn-room-user-list-' + roomId).bind('click', function() {
      self.sortListLexicographically('#firechat-room-user-list-' + roomId);
      return false;
    });

    // Automatically select the new tab.
    this.focusTab(roomId);
  };

  /**
   * Given a room id, focus the given tab.
   *
   * @param    {string}    roomId
   */
  Man2ManChatUI.prototype.focusTab = function(roomId) {
    if (this.$messages[roomId]) {
      var $tabLink = this.$tabList.find('[data-room-id=' + roomId + ']').find('a');
      if ($tabLink.length) {
        $tabLink.first().trigger('click');
      }
    }
  };

  /**
   * Given a room id, remove the tab and all child elements from the interface.
   *
   * @param    {string}    roomId
   */
  Man2ManChatUI.prototype.removeTab = function(roomId) {
    delete this.$messages[roomId];

    // Remove the inner tab content.
    this.$tabContent.find('[data-room-id=' + roomId + ']').remove();

    // Remove the tab from the navigation menu.
    this.$tabList.find('[data-room-id=' + roomId + ']').remove();

    // Dynamically update the width of each tab based upon the number open.
    // var tabs = this.$tabList.children('li');
    // var tabWidth = Math.floor($('#firechat-tab-list').width() / tabs.length);
    // this.$tabList.children('li').css('width', tabWidth);

    // Automatically select the next tab if there is one.
    this.$tabList.find('[data-toggle="firechat-tab"]').first().trigger('click');

    // Update the room listing to reflect that we're now in the room.
    this.$roomList.children('[data-room-id=' + roomId + ']').children('a').removeClass('highlight');
  };

  /**
   * Render a new message in the specified chat room.
   *
   * @param    {string}    roomId
   * @param    {string}    message
   */
  Man2ManChatUI.prototype.showMessage = function(roomId, rawMessage) {
    var self = this;
    var isSelfMessage = (self._user && rawMessage.userId == self._user.id);
    // Setup defaults
    var message = {
      id              : rawMessage.id,
      localtime       : self.formatTime(rawMessage.timestamp),
      avatar          : rawMessage.avatar || isSelfMessage ? self._meAvatar : self._othersAvatar,
      message         : rawMessage.message || '',
      image           : rawMessage.image || null,
      file            : rawMessage.file  || null,
      userId          : rawMessage.userId,
      name            : rawMessage.name,
      type            : rawMessage.type || 'default',
      isSelfMessage   : isSelfMessage,
      // disableActions  : (!self._user || rawMessage.userId == self._user.id)
      disableActions  : true
    };

    // While other data is escaped in the Underscore.js templates, escape and
    // process the message content here to add additional functionality (add links).
    // Also trim the message length to some client-defined maximum.
    var messageConstructed = '';
    message.message = _.map(message.message.split(' '), function(token) {
      if (self.urlPattern.test(token) || self.pseudoUrlPattern.test(token)) {
        return self.linkify(encodeURI(token));
      } else {
        return _.escape(token);
      }
    }).join(' ');
    message.message = self.linify(message.message);
    message.message = self.trimWithEllipsis(message.message, self.maxLengthMessage);

    // Populate and render the message template.
    var template = FirechatDefaultTemplates["templates/message.html"];
    var $message = $(template(message));
    var $messages = self.$messages[roomId];
    if ($messages) {

      var scrollToBottom = false;
      if ($messages.scrollTop() / ($messages[0].scrollHeight - $messages[0].offsetHeight) >= 0.95) {
        // Pinned to bottom
        scrollToBottom = true;
      } else if ($messages[0].scrollHeight <= $messages.height()) {
        // Haven't added the scrollbar yet
        scrollToBottom = true;
      }

      $messages.append($message);

      if (scrollToBottom) {
        $messages.scrollTop($messages[0].scrollHeight);
      }
    }
  };

  /**
   * Remove a message by id.
   *
   * @param    {string}    roomId
   * @param    {string}    messageId
   */
  Man2ManChatUI.prototype.removeMessage = function(roomId, messageId) {
    $('.message[data-message-id="' + messageId + '"]').remove();
  };

  /**
   * Given a selector for a list element, sort the items alphabetically.
   *
   * @param    {string}    selector
   */
  Man2ManChatUI.prototype.sortListLexicographically = function(selector) {
    $(selector).children("li").sort(function(a, b) {
        var upA = $(a).text().toUpperCase();
        var upB = $(b).text().toUpperCase();
        return (upA < upB) ? -1 : (upA > upB) ? 1 : 0;
    }).appendTo(selector);
  };

  /**
   * Remove leading and trailing whitespace from a string and shrink it, with
   * added ellipsis, if it exceeds a specified length.
   *
   * @param    {string}    str
   * @param    {number}    length
   * @return   {string}
   */
  Man2ManChatUI.prototype.trimWithEllipsis = function(str, length) {
    str = str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    return (length && str.length <= length) ? str : str.substring(0, length) + '...';
  };

  /**
   * Given a timestamp, format it in the form hh:mm am/pm. Defaults to now
   * if the timestamp is undefined.
   *
   * @param    {Number}    timestamp
   * @param    {string}    date
   */
  Man2ManChatUI.prototype.formatTime = function(timestamp) {
    var date = (timestamp) ? new Date(timestamp) : new Date(),
        hours = date.getHours() || 12,
        minutes = '' + date.getMinutes(),
        ampm = (date.getHours() >= 12) ? 'pm' : 'am';

    hours = (hours > 12) ? hours - 12 : hours;
    minutes = (minutes.length < 2) ? '0' + minutes : minutes;
    return date.toLocaleDateString() + " " + hours + ':' + minutes + ampm;
  };

  /**
   * Inner method to launch a prompt given a specific title and HTML content.
   * @param    {string}    title
   * @param    {string}    content
   */
  Man2ManChatUI.prototype.prompt = function(title, content) {
    var template = FirechatDefaultTemplates["templates/prompt.html"],
        $prompt;

    $prompt = $(template({
      title: title,
      content: content
    })).css({
      top: this.$wrapper.position().top + (0.333 * this.$wrapper.height()),
      left: this.$wrapper.position().left + (0.125 * this.$wrapper.width()),
      width: 0.75 * this.$wrapper.width()
    });
    this.$wrapper.append($prompt.removeClass('hidden'));
    return $prompt;
  };

  // see http://stackoverflow.com/questions/37684/how-to-replace-plain-urls-with-links
  Man2ManChatUI.prototype.linkify = function(str) {
    var self = this;
    return str
      .replace(self.urlPattern, '<a target="_blank" href="$&">$&</a>')
      .replace(self.pseudoUrlPattern, '$1<a target="_blank" href="http://$2">$2</a>');
  };

  Man2ManChatUI.prototype.linify = function(str) {
    var self = this;
    return str.replace(/\n/g, '<br>');
  };

  Man2ManChatUI.prototype.isAtBottom = function(elem) {
    return ( elem.scrollTop + elem.clientHeight >= elem.scrollHeight - /* buffer */10 );
  };

  Man2ManChatUI.prototype.setSendCallback = function(cb) {
    var self = this;
    self._sendCallback = cb;
  };

  Man2ManChatUI.prototype.doMarkAsRead = function(roomId) {
    var self= this;
    self._chat.markAsRead( roomId );
  };

  Man2ManChatUI.prototype.setDropzoneConfig = function(config) {
    var self = this;
    self._dropzoneConfig = config;
  };

})(jQuery);
