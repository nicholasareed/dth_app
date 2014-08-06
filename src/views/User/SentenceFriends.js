/*globals define*/
define(function(require, exports, module) {

    var Engine = require('famous/core/Engine');
    var View = require('famous/core/View');
    var ScrollView = require('famous/views/Scrollview');
    var SequentialLayout = require('famous/views/SequentialLayout');
    var RenderController = require('famous/views/RenderController');
    var FlexibleLayout = require('famous/views/FlexibleLayout');
    var Surface = require('famous/core/Surface');
    var ImageSurface = require('famous/surfaces/ImageSurface');
    var Modifier = require('famous/core/Modifier');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Transitionable     = require('famous/transitions/Transitionable');
    var Transform = require('famous/core/Transform');
    var Matrix = require('famous/core/Transform');
    var RenderNode         = require('famous/core/RenderNode')

    var Utility = require('famous/utilities/Utility');
    var Timer = require('famous/utilities/Timer');

    // Helpers
    var Utils = require('utils');
    var $ = require('jquery-adapter');
    var Handlebars = require('lib2/handlebars-helpers');

    var TabBar = require('famous/widgets/TabBar');
    var HeaderFooterLayout = require('famous/views/HeaderFooterLayout');
    var NavigationBar = require('famous/widgets/NavigationBar');
    var GridLayout = require("famous/views/GridLayout");

    // Subviews
    var StandardHeader = require('views/common/StandardHeader');

    // Extras
    var Credentials         = JSON.parse(require('text!credentials.json'));
    var numeral = require('lib2/numeral.min');

    // Side menu of options
    var GameMenuView      = require('views/Game/GameMenu');

    // Notifications SubView
    var AllView      = require('./Subviews/All');
    var MatchedView      = require('./Subviews/Matched');

    // Models
    var SentenceModel = require("models/sentence");
    var MediaModel = require('models/media');

    function PageView(params) {
        var that = this;
        View.apply(this, arguments);
        this.params = params;

        this.loadModels();

        // create the layout
        this.layout = new HeaderFooterLayout({
            headerSize: 50,
            footerSize: 60
        });

        this.createHeader();

        this._subviews = [];

        this.createContent();

        this.add(this.layout);

    }

    PageView.prototype = Object.create(View.prototype);
    PageView.prototype.constructor = PageView;

    PageView.prototype.loadModels = function(){
        var that = this;

        this.model = new SentenceModel.Sentence();
        this.model.on('sync', function(){
            // sentence expired?
            if(that.model.get('end_time') < new Date()){
                
                that.model.set('active',false);

                Utils.Notification.Toast('Expired');

                // Navigate back to home
                App.history.eraseUntilTag('all-of-em');
                App.history.navigate('user/sentence');
            } else {
                // Update time on navbar title
                that.header.navBar.title.setContent(moment(that.model.get('end_time')).format('h:mma'));
            }

        });
        this.model.on('error', function(res, xhr, res3){
            if(xhr.status == 409){

                that.model.set('active',false);

                Utils.Notification.Toast('Expired');

                // Navigate back to home
                App.history.eraseUntilTag('all-of-em');
                App.history.navigate('user/sentence');
            }
        });

        this.model.fetch();

        var checkFetch = function(){
            Timer.setTimeout(function(){
                if(that.model.get('active') !== true){
                    that.model.fetch();
                    checkFetch();
                }
            }, 5000);
        };
        checkFetch();

    };
    
    PageView.prototype.createHeader = function(){
        var that = this;
        
        // Icons

        // Invite somebody
        this.headerContent = new View();
        this.headerContent.Invite = new Surface({
            content: '<i class="icon ion-ios7-plus-outline">',
            size: [60, undefined],
            classes: ['header-tab-icon-text-big']
        });
        this.headerContent.Invite.on('click', function(){
            // App.Cache.FriendListOptions = {
            //     default: 'outgoing'
            // };
            // App.history.navigate('friend/list');
            App.history.navigate('friend/add');
        });

        // Settings
        this.headerContent.Settings = new Surface({
            content: '<i class="icon ion-ios7-gear-outline"></i>',
            size: [60, undefined],
            classes: ['header-tab-icon-text-big']
        });
        this.headerContent.Settings.on('click', function(){
            App.history.navigate('settings');
        });

        // Send SMS
        this.headerContent.SendSms = new Surface({
            content: '<i class="icon ion-ios7-chatboxes-outline"></i>',
            size: [60, undefined],
            classes: ['header-tab-icon-text-big']
        });
        this.headerContent.SendSms.on('click', function(){
            // Send an SMS to a group of friends (sends each sms in the background?)

            // checkflag (todo) 

            Utils.Notification.Toast('SMS Blast (not done)');

            // parse the sentence and display it
            var parsed_sentence = '';

            window.plugins.socialsharing.shareViaSMS(parsed_sentence, '', function(msg) {console.log('ok: ' + msg)}, function(msg) {Utils.Notification.Toast('error: ' + msg)})

            return;

            // pick the contact to send the sms to
            navigator.contacts.pickContact(function(contact){

                console.log(contact);
                console.log(JSON.stringify(contact));

                // Phone Numbers validation
                if(!contact.phoneNumbers || contact.phoneNumbers.length < 1){
                    // No phone numbers
                    Utils.Notification.Toast('No phone number');
                    return;
                }


                var successFunction = function(ptn){
                    var number = ptn;
                    var message = 'testing a message';
                    var intent = ""; //leave empty for sending sms using default intent
                    var success = function () { Utils.Notification.Toast('Message sent successfully'); };
                    var error = function (e) { Utils.Notification.Toast('Message Failed:' + e); };
                    sms.send(number, message, intent, success, error);
                }

                // Single Number?
                if(contact.phoneNumbers.length == 1){
                    successFunction(contact.phoneNumbers[0]);
                } else {

                    // Multiple numbers (expected)

                    var listData = [];
                    contact.phoneNumbers.forEach(function(ptn){
                        listData.push({
                            text: JSON.stringify(ptn),
                            value: ptn,
                            success: function(){

                                successFunction(ptn);


                            }
                        });
                    });

                    Utils.Popover.List(listData);

                }

            });

            // App.history.navigate('settings');
        });

        

        // create the header
        this.header = new StandardHeader({
            content: "",
            classes: ["normal-header"],
            backClasses: ["normal-header"],
            backContent: '<i class="icon ion-close-round"></i>',
            moreClasses: ["normal-header"],
            moreSurfaces: [
                this.headerContent.SendSms,
                this.headerContent.Invite,
                this.headerContent.Settings
            ]
            
        });
        this.header._eventOutput.on('back',function(){
            // App.history.back();
            that.goBack();
        });
        this.header.navBar.title.on('click',function(){
            // App.history.back();
            that.goBack();
        });

        this._eventOutput.on('inOutTransition', function(args){
            this.header.inOutTransition.apply(this.header, args);
        })

        // // Node for Modifier and background
        // this.HeaderNode = new RenderNode();
        // this.HeaderNode.add(this.headerBg);
        // this.HeaderNode.add(this.header.StateModifier).add(this.header);

        // Attach header to the layout        
        this.layout.header.add(this.header);

    };

    PageView.prototype.goBack = function(){
        var that = this;

        // Erase the existing Sentence, if one exists
        if(that.model.get('active') || that.model.get('end_time') > new Date()){

            Utils.Popover.Buttons({
                title: 'Clear Previous?',
                buttons: [
                    {
                        text: 'Nah, stay here'
                    },
                    {
                        text: 'Yup, go back',
                        success: function(){

                            Utils.Notification.Toast('One moment please');

                            // Clear previous
                            that.model.disable();

                            // redirect
                            App.history.eraseUntilTag('all-of-em');
                            App.history.navigate('user/sentence');
                        }
                    }
                ]
            });

            return;

        }

        // Doesn't seem to exist, just go back
        App.history.eraseUntilTag('all-of-em');
        App.history.navigate('user/sentence');

    };
    
    PageView.prototype.createContent = function(){
        var that = this;

        // this.contentScrollView = new ScrollView(App.Defaults.ScrollView);
        this.contentScrollView = new FlexibleLayout({
            direction: FlexibleLayout.DIRECTION_Y,
            ratios: [true, 1]
        });
        this.contentScrollView.Views = [];

        // Content
        this.ContentStateModifier = new StateModifier();

        // Create the Tabs
        this.TopTabs = new View();
        this.TopTabs.Bar = new TabBar();
        this.TopTabs.BarSizeMod = new StateModifier({
            size: [undefined, 80]
        });
        this.TopTabs.getSize = function(){
            return [undefined, 80];
        };
        this.TopTabs.add(this.TopTabs.BarSizeMod).add(this.TopTabs.Bar);

        this.TopTabs.Bar.defineSection('all', {
            content: '<i class="icon ion-android-friends"></i><div>Select Friends</div>',
            onClasses: ['select-friends-tabbar-default', 'on'],
            offClasses: ['select-friends-tabbar-default', 'off']
        });
        this.TopTabs.Bar.defineSection('matched', {
            content: '<i class="icon ion-ios7-checkmark-outline"></i><div>Available</div>',
            onClasses: ['select-friends-tabbar-default', 'on'],
            offClasses: ['select-friends-tabbar-default', 'off']
        });

        // Add tabs to sequence
        this.contentScrollView.Views.push(this.TopTabs);

        // Tab content
        this.TopTabs.Content = new RenderController();

        // Add Lightbox to sequence
        this.contentScrollView.Views.push(this.TopTabs.Content);

        // Listeners for Tabs
        this.TopTabs.Bar.on('select', function(result){
            switch(result.id){

                case 'all':
                    that.TopTabs.Content.show(that.TopTabs.Content.AllFriends);
                    that.TopTabs.Content.AllFriends.View.collection.fetch();
                    break;

                case 'matched':
                    that.TopTabs.Content.show(that.TopTabs.Content.MatchedFriends);
                    that.TopTabs.Content.MatchedFriends.View.collection.fetch();
                    break;

                default:
                    alert('none chosen');
                    break;
            }
        });

        App.Data.User.populated().then((function(){

            // All 
            this.TopTabs.Content.AllFriends = new View();
            this.TopTabs.Content.AllFriends.View = new AllView({
                model: this.model
            });
            this.TopTabs.Content.AllFriends.add(this.TopTabs.Content.AllFriends.View);
            this._subviews.push(this.TopTabs.Content.AllFriends.View);

            // Matched
            this.TopTabs.Content.MatchedFriends = new View();
            this.TopTabs.Content.MatchedFriends.View = new MatchedView({
                model: this.model
            });
            this.TopTabs.Content.MatchedFriends.add(this.TopTabs.Content.MatchedFriends.View);
            this._subviews.push(this.TopTabs.Content.MatchedFriends.View);

            // This depends on the previously selected! 
            this.TopTabs.Bar.select('all');

        }).bind(this));

        this.layout.content.add(this.ContentStateModifier).add(this.contentScrollView);

        // Flexible Layout sequencing
        this.contentScrollView.sequenceFrom(this.contentScrollView.Views);

    };

    PageView.prototype.refreshData = function() {
        try {
            // this.model.fetch();
            // this.media_collection.fetch();
            // this.errorList.fetch();
            // this.alert_collection.fetch();
            // this.CarTripListView.collection.fetch();
        }catch(err){};
    };

    PageView.prototype.inOutTransition = function(direction, otherViewName, transitionOptions, delayShowing, otherView, goingBack){
        var that = this;

        this._eventOutput.emit('inOutTransition', arguments);

        switch(direction){
            case 'hiding':
                switch(otherViewName){

                    default:
                        // Overwriting and using default identity
                        transitionOptions.outTransform = Transform.identity;

                        that.ContentStateModifier.setOpacity(0);

                        // Hide/move elements
                        window.setTimeout(function(){
                            
                            // // Fade header
                            // that.header.StateModifier.setOpacity(0, transitionOptions.outTransition);

                            // Slide content down
                            that.ContentStateModifier.setOpacity(1, transitionOptions.outTransition);

                        }, delayShowing);

                        break;
                }

                break;
            case 'showing':
                if(this._refreshData){
                    // window.setTimeout(that.refreshData.bind(that), 1000);
                }
                this._refreshData = true;
                switch(otherViewName){

                    default:

                        // No animation by default
                        transitionOptions.inTransform = Transform.identity;

                        // // Default header opacity
                        // that.header.StateModifier.setOpacity(0);

                        // // Default position
                        // if(goingBack){
                        //     that.ContentStateModifier.setTransform(Transform.translate(window.innerWidth * -1,0,0));
                        // } else {
                        //     that.ContentStateModifier.setTransform(Transform.translate(window.innerWidth + 100,0,0));
                        // }
                        that.ContentStateModifier.setOpacity(0);

                        // Header
                        // - no extra delay
                        window.setTimeout(function(){

                            // // Change header opacity
                            // that.header.StateModifier.setOpacity(1, transitionOptions.outTransition);

                        }, delayShowing);

                        // Content
                        // - extra delay for content to be gone
                        window.setTimeout(function(){

                            // Bring map content back
                            that.ContentStateModifier.setOpacity(1, transitionOptions.inTransition);

                        }, delayShowing + transitionOptions.outTransition.duration);

                        break;
                }
                break;
        }
        
        return transitionOptions;
    };

    PageView.prototype.backButtonHandler = function(){
        this.goBack();
    };


    PageView.DEFAULT_OPTIONS = {
        header: {
            size: [undefined, 50],
        },
        footer: {
            size: [0,0]
        },
        content: {
            size: [undefined, undefined],
            inTransition: true,
            outTransition: true,
            overlap: true
        }
    };

    module.exports = PageView;

});
