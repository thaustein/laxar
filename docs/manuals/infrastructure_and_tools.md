[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)
* [Pages and Flows](./widgets_and_activities.md)
* [Creating Themes](./creating_themes.md)
* [Widgets and Activities](./widgets_and_activities.md)

# Infrastructure and Tools

What does actually happen when you navigate to a LaxarJS page using the browser?
How does LaxarJS load your widgets, their assets and styles?
And what is the difference between the `debug.html` and `index.html` in the application template?
Read on to understand the inner workings of a LaxarJS application.

## Application Lifecycle

The [LaxarJS application template](//github.com/LaxarJS/grunt-init-laxar-application/tree/master/root) contains a `debug.html` which helps to bootstrap you application.
Additionally, there is an `index.html` that allows you to run the application using optimized scripts and assets. 

In your own application, you do not have to actually use these files:
Instead you may copy the relevant parts into a [Ruby on Rails](http://rubyonrails.org/) or [Django](https://www.djangoproject.com/) template, or into a [JSP](http://en.wikipedia.org/wiki/JavaServer_Pages) and bootstrap LaxarJS from there.

### Scaffolding

Let us dissect the startup process of a LaxarJS application based on the `debug.html`, only that we have removed everything that is not absolutely required:

```HTML
<!DOCTYPE html>
<html>
<head><!-- ... optional: meta elements, title, page blocker styles go here ... --></head>
<body>
  <div data-ax-page></div>
  <div data-ng-view></div>

  <script data-ax-application-mode="DEBUG" src="application/application.js"></script>
  <script src="require_config.js"></script>
  <script data-main="../init.js" src="bower_components/requirejs/require.js"></script>
</body>
</html>
```

What do the individual elements mean?

  * The `axPage` directive determines where LaxarJS will place the layout for the current page.

  * The `ngView` directive integrates the [$ngRoute](https://docs.angularjs.org/api/ngRoute)-service, which the [LaxarJS flow] uses for URL routing.
  
  * The `application/application.js` contains the [LaxarJS configuration](./configuration.md) for your application.
    The `data-ax-application-mode` attribute allows to differentiate configuration between _DEBUG_ and _RELEASE_ mode.
    It allows you to use bundled CSS, HTML and JSON assets for production, while always using their fresh source version during development. 
    The attribute is not used by LaxarJS itself, but only by the `application.js` which is under your control, so using it is a convention rather than an API.

  * The `require_config.js` configures paths to libraries for [AMD-loading](http://requirejs.org/docs/whyamd.html).
    These may be your own libraries or 3rd party libraries installed through [Bower](http://bower.io/).
    
  * Finally, [RequireJS](http://requirejs.org) is loaded to bootstrap your application:
    The `data-main` tells RequireJS where to find the initialization code (`init.js`), which is the entry point to all AMD-modules for your application.
    AngularJS modules are automatically loaded for any [widgets/activities](./widgets_and_activities.md) and [controls](./providing_controls.md) that are reachable from your [flow](./flow_and_places.md):   
    a LaxarJS grunt-task prepares this list whenever you `npm install` your application or `npm start` the development server, so usually you will not have manage AngularJS modules manually.
    For production (`grunt optimize`, see below), all RequireJS dependencies are combined and minified by default.


### Setup



### The Page Blocker

TODO
