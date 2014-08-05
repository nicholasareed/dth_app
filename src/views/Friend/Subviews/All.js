/*globals define*/
define(function(require, exports, module) {

    var Engine = require('famous/core/Engine');
    var View = require('famous/core/View');
    var ScrollView = require('famous/views/Scrollview');
    var SequentialLayout = require('famous/views/SequentialLayout');
    var Surface = require('famous/core/Surface');
    var Modifier = require('famous/core/Modifier');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Transitionable     = require('famous/transitions/Transitionable');
    var Transform = require('famous/core/Transform');
    var Matrix = require('famous/core/Transform');
    var RenderNode = require('famous/core/RenderNode')

    var Lightbox = require('famous/views/Lightbox');
    var RenderController = require('famous/views/RenderController');

    var Utility = require('famous/utilities/Utility');

    var HeaderFooterLayout = require('famous/views/HeaderFooterLayout');
    var NavigationBar = require('famous/widgets/NavigationBar');
    var GridLayout = require("famous/views/GridLayout");

    var Backbone = require('backbone-adapter');

    // Models
    var UserModel = require("models/user");

    // Extras
    var Utils = require('utils');
    var numeral = require('lib2/numeral.min');

    // Templates
    var Handlebars          = require('lib2/handlebars-adapter');
    var tpl                 = require('text!./tpl/Friend.html');
    var template            = Handlebars.compile(tpl);

    function SubView(options) {
        var that = this;
        View.apply(this, arguments);
        this.options = options;

        // Load models
        this.loadModels();

        // Should switch to a RenderController or Lightbox for displaying this content?
        // - it would make it easy to switch between Loading / No Results / RealResults

        // this.contentLayout = new SequentialLayout();
        this.contentLayout = new ScrollView();
        this.contentLayout.Views = [];
        this.contentLayout.sequenceFrom(this.contentLayout.Views);

        this.createDefaultSurfaces();
        this.createDefaultLightboxes();

        this.contentLayout.Views.push(this.lightboxButtons);

        // Gather data after structure built
        App.Data.User.populated().then(function(){

            that.update_friend_collection();
            App.Data.User.on('sync', that.update_friend_collection.bind(that));

        });

        // Need to wait for at least 1 item before showing the result?
        // - otherwise, there is a Render error
        this.add(this.lightboxContent);

    }

    SubView.prototype = Object.create(View.prototype);
    SubView.prototype.constructor = SubView;


    SubView.prototype.loadModels = function(player_id){
        var that = this;

        // App.Data.User contains friends



        // Create collection of Games for player_id
        var options = {};
        // if(this.options && this.options.filter){
        //     options['$filter'] = this.options.filter;
        // }
        this.collection = new UserModel.UserCollection();
        this.collection.on("sync", that.updateCollectionStatus.bind(this), this);
        this.collection.on("add", this.addOne, this);
        // this.collection.on("remove", this.removeOne, this);
        this.collection.infiniteResults = 0;
        this.collection.totalResults = 0;

        this.prior_list = [];

        // Listen for 'showing' events
        this._eventInput.on('inOutTransition', function(args){
            // 0 = direction
            if(args[0] == 'showing'){
                // that.collection.fetch();
            }
        });

    };

    SubView.prototype.update_friend_collection = function(){
        var that = this;

        var all_friends = App.Data.User.get('friends');

        // App.Data.User contains our friend list
        if(this.prior_list == all_friends){
            this.collection.trigger('sync');
            return;
        }

        // Get new friends
        var new_friends = _.difference(all_friends, this.prior_list);
        _.each(new_friends, function(friend_id){
            var tmpModel = new UserModel.User({
                profile_id: friend_id
            });
            tmpModel.populated().then(function(){
                that.collection.add(tmpModel);
            });
            if(!tmpModel.hasFetched){
                tmpModel.fetch();
            }
        });

        // Get reductions
        var old_friends = _.difference(this.prior_list, all_friends);
        _.each(old_friends, function(friend_id){
            that.collection.remove(that.collection.get(friend_id));
        });

        // update old values
        this.prior_list = _.clone(all_friends);

        this.collection.trigger('sync');

    };

    SubView.prototype.createDefaultSurfaces = function(){
        var that = this;

        // Should switch to a RenderController or Lightbox for displaying this content?
        // - it would make it easy to switch between Loading / No Results / RealResults

        // Create Loading Renderable
        // Create "No Results" Renderable
        this.loadingSurface = new Surface({
            content: "Loading",
            size: [undefined, 100],
            classes: ['loading-surface-default']
        });
        this.loadingSurface.pipe(this._eventOutput);
        this.emptyListSurface = new Surface({
            content: "None to Show",
            size: [undefined, 100],
            classes: ['empty-list-surface-default'],
            properties: {
                // backgroundColor: 'red'
            }
        });
        this.emptyListSurface.pipe(this._eventOutput);


        // Create Loading Renderable
        this.infinityLoadingSurface = new Surface({
            content: "Loading...",
            size: [undefined, 50],
            classes: ['infinity-loading-surface-default']
        });
        this.infinityLoadingSurface.pipe(this._eventOutput);

        // Loaded 'em all!
        // - shows "X total events"
        this.infinityLoadedAllSurface = new Surface({
            content: "Loaded All, I guess?",
            size: [undefined, 50],
            classes: ['infinity-all-loaded-surface-default']
        });
        this.infinityLoadedAllSurface.pipe(this._eventOutput);

        // Show more
        this.infinityShowMoreSurface = new Surface({
            content: "Show More", // would usually show the total number left too
            size: [undefined, 50],
            classes: ['infinity-show-more-surface-default']
        });
        this.infinityShowMoreSurface.pipe(this._eventOutput);
        this.infinityShowMoreSurface.on('click', function(){
            that.next_page();
        });
    };

    SubView.prototype.createDefaultLightboxes = function(){
        var that = this;

        // Content Lightbox
        this.lightboxContent = new RenderController();
        this.lightboxContent.show(this.loadingSurface);
        this.lightboxContent.getSize = function(){
            try {
                var s = this._renderables[this._showing].getSize(true);
                if(s){
                    this.lastSize = [undefined, s[1]];
                    return [undefined, s[1]];
                }
            }catch(err){}
            // Last Size?
            if(this.lastSize){
                return this.lastSize;
            }
            return [undefined, true];
        };

        // Buttons lightbox
        this.lightboxButtons = new RenderController();
        this.lightboxButtons.show(this.infinityLoadingSurface);
        this.lightboxButtons.getSize = function(){
            try {
                var s = this._renderables[this._showing].getSize(true);
                if(s){
                    this.lastSize = [undefined, s[1]];
                    return [undefined, s[1]];
                }
            }catch(err){}
            // Last Size?
            if(this.lastSize){
                return this.lastSize;
            }
            return [undefined, true];
        };

    };

    SubView.prototype.addOne = function(Model){
        var that = this;

        var userView = new View(),
            name = Model.get('profile.name') || '&nbsp;none';

        userView.Model = Model;
        userView.Surface = new Surface({
             content: '<div>' +name+'</div>',
             size: [undefined, 60],
             classes: ['player-list-item-default']
        });
        userView.Surface.pipe(that.contentLayout);
        userView.Surface.on('click', function(){
            // App.history.navigate('player/' + Model.get('_id'));
        });
        userView.add(userView.Surface);

        this.contentLayout.Views.splice(this.contentLayout.Views.length-1, 0, userView);
        this.collection.infiniteResults += 1;

    };

    SubView.prototype.addOne2 = function(Message) { 
        var that = this;

        var messageView = new View();

        var other_person_id;
        // console.info(Message.get('from_user_id'), App.Data.User.get('_id'));
        if(Message.get('from_user_id') == App.Data.User.get('_id')){
            console.info('to', Message.get('from_user_id'), App.Data.User.get('_id'));
            console.info('to', Message.get('to_user_id'));
            other_person_id = Message.get('to_user_id');
        } else {
            console.info('from', Message.get('from_user_id'), App.Data.User.get('_id'));
            other_person_id = Message.get('from_user_id');
        }

        var surfaceData = function(){
            
            var content = template({
                message: Message.toJSON(),
                other_person_id: other_person_id,
                show_other_person: that.options.show_other_person,
                ago: moment(Message.get('created')).format('h:mma - MMM Do'),
                time_remaining: '1h 20m',
                activities_list: [
                    {
                        text: 'outdoors',
                        bold: true
                    },
                    {
                        text: 'drinking',
                        bold: false
                    },
                    {
                        text: 'just chill',
                        bold: false
                    }
                ]
                // image_src: imageSrc
            })

            return {
                content: content
            };
        };
        
        messageView.Surface = new Surface({
            content: surfaceData().content,
            size: [undefined, true],
            classes: ['message-text-default']
        });
        Utils.dataModelReplaceOnSurface(messageView.Surface);

        Message.on('change', function(){
            messageView.Surface.setContent(surfaceData().content);
            Utils.dataModelReplaceOnSurface(messageView.Surface);
        });

        messageView.Surface.pipe(this._eventOutput);
        messageView.Surface.pipe(this.contentLayout);
        messageView.Surface.Model = Message;
        messageView.add(messageView.Surface);
        messageView.getSize = function(){
            if(messageView.Surface.getSize(true)){
                return [undefined, messageView.Surface.getSize(true)[1]];
            }
            return [undefined, undefined];
        };

        // Splice in
        this.contentLayout.Views.splice(this.contentLayout.Views.length-1,0,messageView);
        this.collection.infiniteResults += 1;

        // if(!this.contentLayout.isSeq){
            // this.contentLayout.isSeq = true;
            this.contentLayout.sequenceFrom(this.contentLayout.Views);
        // }

        console.log(this.contentLayout.Views);

    };

    SubView.prototype.updateCollectionStatus = function() { 
        console.info('updateCollectionStatus');

        this.collection.totalResults = App.Data.User.get('friends').length;

        // Update amounts left
        var amount_left = this.collection.totalResults - this.collection.infiniteResults;
        this.infinityShowMoreSurface.setContent(amount_left + ' more');
        this.infinityLoadedAllSurface.setContent(this.collection.totalResults + ' total');

        var nextRenderable;
        if(this.collection.length == 0 && this.collection.infiniteResults == 0){
            nextRenderable = this.emptyListSurface;
        } else {
            nextRenderable = this.contentLayout;
        }

        if(nextRenderable != this.lightboxContent.lastRenderable){
            this.lightboxContent.lastRenderable = nextRenderable;
            this.lightboxContent.show(nextRenderable);
        }

        // Splice out the lightboxButtons before sorting
        var popped = this.contentLayout.Views.pop();

        // Resort the contentLayout.Views
        this.contentLayout.Views = _.sortBy(this.contentLayout.Views, function(v){
            console.log(v.Model.get('profile.name').toLowerCase());
            return v.Model.get('profile.name').toLowerCase();
        });

        this.contentLayout.Views.push(popped);

        console.log(this.contentLayout.Views);

        // Re-sequence?
        this.contentLayout.sequenceFrom(this.contentLayout.Views);

        // Show correct infinity buttons (More, All, etc.)
        this.render_infinity_buttons();

    };

    SubView.prototype.render_infinity_buttons = function(){
        // Renders the correct infinity-list buttons (the "Show More" or "Is loading" button/hint) at the bottom of the page

        // // Hide all dat shit
        // // - unnecessary?
        // this.$('.load-list').addClass('nodisplay');

        // at the end?
        if(this.collection.infiniteResults == this.collection.totalResults){
            this.lightboxButtons.show(this.infinityLoadedAllSurface);
            // this.$('.loaded-all').removeClass('nodisplay');
        } else {
            // Show more
            // - also includes the number more to show :)
            this.lightboxButtons.show(this.infinityShowMoreSurface);
            // this.$('.show-more').removeClass('nodisplay');
        }

    };

    SubView.prototype.refresh_any_new = function(){
        // Load any newly-created (since we last loaded) models
        // - todo...

        // bascially like next_page, right?

        // Load more games
        var that = this;

        // Make sure we're only loading one page at a time
        if(this.isUpdating === true){
            return;
        }
        this.isUpdating = true;

        console.info('actually next_page');
        // debugger;

        this.lightboxButtons.show(this.infinityLoadingSurface);
        // this.$('.load-list').addClass('nodisplay');
        // this.$('.loading-progress').removeClass('nodisplay');

        // Init request
        this.collection.requestNextPage({
            success: function(){
                // alert('loaded next page!');
                that.isUpdating = false;
                // Utils.Notification.Toast('Showing Alerts');
                that.render_infinity_buttons();
            },
            error: function(){
                that.isUpdating = false;
                Utils.Notification.Toast('Failed loading more Alerts!');
                that.render_infinity_buttons();
            }
        });
    };

    SubView.prototype.next_page = function(){
        // Load more games
        var that = this;

        // Make sure we're only loading one page at a time
        if(this.isUpdating === true){
            return;
        }
        this.isUpdating = true;

        console.info('actually next_page');
        // debugger;

        this.lightboxButtons.show(this.infinityLoadingSurface);
        // this.$('.load-list').addClass('nodisplay');
        // this.$('.loading-progress').removeClass('nodisplay');

        // Init request
        this.collection.requestNextPage({
            success: function(){
                // alert('loaded next page!');
                that.isUpdating = false;
                // Utils.Notification.Toast('Showing Alerts');
                that.render_infinity_buttons();
            },
            error: function(){
                that.isUpdating = false;
                Utils.Notification.Toast('Failed loading more Alerts!');
                that.render_infinity_buttons();
            }
        });
    };


    SubView.DEFAULT_OPTIONS = {
    };

    module.exports = SubView;

});
