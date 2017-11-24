<?php
    $staff_id = '4';
    $staff_name = 'test';
?>
  <style type="text/css">
    #firechat-all-user-room-list { height: 500px; overflow: scroll; }
    .user-item-container { padding: 10px 0; border-bottom: 1px solid #ccc; }
  </style>

  <link rel="stylesheet" href="../dist/bootstrap.min.css"/>
  <link rel="stylesheet" type="text/css" href="../dist/man2manchat.css">
  <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/font-awesome/4.5.0/css/font-awesome.min.css" type="text/css" />
  <link rel="stylesheet" type="text/css" href="http://tkrotoff.github.io/famfamfam_flags/famfamfam-flags.css">


<div id="main-wrapper">

  <div id="content-wrapper">
    <div class="page-header">
          
      <div class="row">
      <!-- Page header, center on small screens -->
        <h1 class="col-xs-12 col-sm-4 text-center text-left-sm"><i class="fa fa-comment page-header-icon"></i>&nbsp;&nbsp;チャット</h1>
      </div>
    </div> <!-- / .page-header -->

    <div class="row">
      <div class="col-md-12">
        <div id="firechat-wrapper">
        <!-- <button onclick="login('twitter');">Login with Twitter</button> -->
          <button onclick="signin();">Login</button>
        </div>

      </div>

      <!-- <div class="col-md-5">
        <div class="row from-control">
          <h4 class="col-sm-4">User List</h4>
          <div class="col-sm-8">
            <input type="text" placeholder="Search Usear" class="form-control" id="searchUser" />
          </div>
        </div>
        <div id="firechat-all-user-room-list">
            <div class="user-item-container">
              <img src="" width="50" alt="" class="pull-left col-sm-3">
              <div class="pull-left col-sm-9"><span>Test (User)<br>ID: 1</span></div>
              <div>
                <?php
                  $job_chat_id = "user1_job-consult";
                  $job_chat_name = "Test User (Job Consult)";

                  $living_chat_id = "user1_living";
                  $living_chat_name = "Test User (Living)";

                  $personal_chat_id = "user1_staff1";
                  $personal_chat_name = "Test User (Personal)";
                ?>
                <a class="btn btn-default btn-sm" data-room-id="<?php echo $job_chat_id; ?>" data-room-name="<?php echo $job_chat_name; ?>" href="#<?php echo $job_chat_id . ':' . $job_chat_name; ?>">Job Consult</a>
                
                <a class="btn btn-default btn-sm" data-room-id="<?php echo $living_chat_id; ?>" data-room-name="<?php echo $living_chat_name; ?>" href="#<?php echo $living_chat_id . ':' . $living_chat_name; ?>">Living</a>

                <a class="btn btn-default btn-sm" data-room-id="<?php echo $personal_chat_id; ?>" data-room-name="<?php echo $personal_chat_name; ?>" href="#<?php echo $personal_chat_id . ':' . $personal_chat_name; ?>">Personal</a>
              </div>
            </div>
        </div>
      </div> -->


    </div>
  </div> <!-- / #content-wrapper -->
</div> <!-- / #main-wrapper -->


<!-- jQuery -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js"></script>
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/3.3.0/firebase.js"></script>
<!-- Firechat -->
<link rel="stylesheet" href="../dist/firechat.css"/>
<link rel="stylesheet" type="text/css" href="../dist/dropzone.css">
<!-- <script src="https://cdn.firebase.com/libs/firechat/3.0.1/firechat.min.js"></script> -->
<script src="../dist/man2manchat.js"></script>
<!-- <script type="text/javascript" src="https://rawgit.com/enyo/dropzone/master/dist/dropzone.js"></script> -->
<script>var init = [];</script>
<script>
  var config = {
    apiKey: "AIzaSyAwxvZYOginXkQoKH6YaeulX63I0lkzu0k",
    authDomain: "inspection-multiroom-chat.firebaseio.com",
    databaseURL: "https://inspection-multiroom-chat.firebaseio.com/",
    storageBucket: "inspection-multiroom-chat.appspot.com",
  }
  firebase.initializeApp(config)

  function initChat(user) {
    var chatRef = firebase.database().ref("chat");
    var chat = new Man2ManChatUI(chatRef, document.getElementById("firechat-wrapper"), {"file_downloadable":false, "allow_markasread":false});
    // var chat = new FirechatUI(chatRef, document.getElementById("firechat-wrapper"));
    console.log("user2", user)

    // TODO: =====
    // uid and displayName information should be set by JWT
    var uid = user.uid;
    var displayName = user.displayName;
    // Remove the part below after complete integrating token authentication
    uid = "staff<?php echo $staff_id; ?>";
    displayName = "<?php echo $staff_name; ?>";
    // ===========
    chat.setUser(uid, displayName, function(ch){
      var roomCode = location.hash.replace(/^\#/, '')
      console.log("test", roomCode)

      if ( roomCode ) {
        var roomId = roomCode.split(':')[0]
        var roomName = roomCode.split(':')[1]
        console.log(roomId, roomName)
        ch.selectUserRoom( roomId, roomName )
      } else {
        ch._chat.resumeSession()
      }
            
      $(document).on('click', "#firechat-all-user-room-list a", function(){
        // var parent = $(this).parent(),
        // roomId = parent.data('room-id'),
        // roomName = parent.data('room-name');
        var roomId = $(this).data('room-id')
        var roomName = $(this).data('room-name')
        ch.selectUserRoom(roomId, roomName)
      });

    });

    chat.setSendCallback(function(payload){
      console.log("send callback: ", payload)
      // let userId = payload.roomId.replace("room-user-", "")
      // let csrf_token = document.querySelector('meta[name="csrf-token"]').content
      // fetch(
      // "/admin/ajax/user_push_message/" + userId, {
      // method: "POST",
      // headers: new Headers({
      // "X-CSRF-Token": csrf_token,
      // 'Accept': 'application/json',
      // 'Content-Type': 'application/json',
      // }),
      // credentials: "same-origin",
      // body: JSON.stringify({
      // content: "にしてつ不動産より新着のメッセージがあります"
      // })
      // }).then(function(response){
      // return response.json()
      // }).then(function(data){
      // // let token = data.token
      // // firebase.auth().signInWithCustomToken(token).catch(function(error){
      // // console.error(error)
      // // })
      // }).catch(function(error){
      // console.error(error)
      // })
    })
  }

  firebase.auth().onAuthStateChanged(function(user) {
    if ( user ) {
      initChat(user);
    }
  });

  function signin() {
    fetch(
    "chatroom/fire_auth.json", {
      method: "POST",
      credentials: "same-origin",
      body: {}
    }).then(function(response){
      return response.json()
    }).then(function(data){
      let token = data.token
      firebase.auth().signInWithCustomToken(token).catch(function(error){
        console.error(error)
      })
    }).catch(function(error){
      console.error(error)
    })
  }


  $('#searchUser').on('change', function(){
    var value = $(this).val();
    var setURL = "?name="+value;
    $('#firechat-all-user-room-list').html('Loading...');
    fetch(
    "chatroom/user_filter.json"+setURL, {
      method: "GET",
      credentials: "same-origin",
      body: { name: value, nick_name: value }
    }).then(function(response){
      return response.json()
    }).then(function(data){
      var data = data["user_list"]["data"];
      var html = "";
      $.each(data, function(key, value){
        // console.log(value);
        var job_chat_id = "user" + value['id'] + "_job-consult";
        var job_chat_name = value['name'] + "(Job Consult)";

        var living_chat_id = "user" + value['id'] + "_living";
        var living_chat_name = value['name'] + "(Living)";

        var personal_chat_id = "user" + value['id'] + "_staff${staff_id}";
        var personal_chat_name = value['name'] + "(Personal)";
        html += '<div class="user-item-container">\
                <img src="'+value['icon_path']+'" width="50" alt="" class="pull-left col-sm-3">\
                <div class="pull-left col-sm-9"><span>'+value['name']+' ('+value['nick_name']+')<br>ID: '+value['id']+'</span></div>\
                <div>\
                  <a class="btn btn-default btn-sm" data-room-id="'+job_chat_id+'" data-room-name="'+job_chat_name+'" href="#'+job_chat_id + ':' + job_chat_name+'">Job Consult</a>\
                  <a class="btn btn-default btn-sm" data-room-id="'+living_chat_id+'" data-room-name="'+living_chat_name+'" href="#'+living_chat_id + ':' + living_chat_name+'">Living</a>\
                  <a class="btn btn-default btn-sm" data-room-id="'+personal_chat_id+'" data-room-name="'+personal_chat_name+'" href="#'+personal_chat_id + ':' + personal_chat_name+'">Personal</a>\
                </div>\
              </div>';
        // alert(html)
      })
      $('#firechat-all-user-room-list').html(html);
    }).catch(function(error){
      console.error(error)
    })
  })

</script>
