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

The `axPage` directive determines where LaxarJS will insert the template for the current page.
The `ngView` directive is used to trigger the [$ngRoute]()-service, which LaxarJS uses for URL handling. 

### The Page Blocker

TODO
