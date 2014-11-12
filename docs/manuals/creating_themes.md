[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)
* [Widgets and Activities](./widgets_and_activities.md)
* [Writing Pages](./writing_pages.md)


# Creating Themes

Sometimes you would like to use the _one widget_ in _two or more applications_.
For this, usually you want the widget to _behave identically_, but _look differently_.
Alternatively, you would sometimes like to offer the same application in different appearances.
LaxarJS has the concept of _themes_ to help you achieve these things.


## Why Themes?

LaxarJS ships with a so-called _default theme_, which is actually just [Bootstrap CSS](http://getbootstrap.com/css/) together with [Font Awesome](http://fortawesome.github.io/Font-Awesome/) and a few additional classes.
There are several ways to add your own styles.


### From Ad-Hoc Styles to Theme Folders… 

Usually, you will need to add some CSS classes of your own.
For example, the vast majority of web application needs some styling for the page background and positioning or custom header and footer areas.
To include such _ad-hoc styles_, you _could_ simply add a CSS file of your own to the project, and load it from the debug.html and index.html files using the `<link>` tag.
However, it is _recommended_ to add these styles to your main application layout instead, into a sub-folder called `default.theme/css`.

The _benefit_ of using such a _theme folder_ is that

  * your CSS will be _bundled and compressed_ together with Bootstrap (no `<link>` tag needed) and that
  * you can support different _themes_ simply by adding more `.theme` folders.

Due to the first point, using the theme folders is useful and recommended _even_ if you only use (and maybe customize) the default theme.
The LaxarJS [MashupDemo](http://laxarjs.org/demos/mashupdemo/) application takes this no-fuss approach to customizing Bootstrap.


### …and to Custom Themes

As soon as you use multiple page layouts, the previous approach does not really scale anymore: you would have to duplicate your global styles to all of them.
In these cases, creating your own theme is definitely recommended.
A detailed explanation of [creating a theme](#creating-a-theme) is given below.


### A Note on Compass/SCSS

When using theme folders or entire themes, the runtime will only ever look at `.css` files in `css` sub-folders.
This means that it is entirely _up to you_ which (if any) CSS authoring tools you would like to use.

That being said, we use Compass/SCSS to create themes, and the default-theme is based on the SCSS version of Bootstrap.
Using this approach makes it very easy to create a custom theme just by changing some Bootstrap SCSS variables.
Also, by using SCSS variables defined in the theme, widgets and controls can provide a consistent appearance.
After explaining themes in general, below are instructions on [creating an SCSS theme](#creating-an-scss-theme).


<a name="creating-a-theme"></a>
## Creating your own Theme

Let us create our own theme for an existing application, the [LaxarJS ShopDemo](http://laxarjs.org/demos/shopdemo/).
The ShopDemo brings it's own theme _"laxar_demo"_, which is implemented by augmenting Bootstrap with some custom additions.

![LaxarJS ShopDemo using laxar_demo theme](creating_themes/shop_demo_laxar_demo_50.png)

**_Above:_ The LaxarJS ShopDemo using the _laxar_demo_ theme**

However, the demo also works with just the default theme, provided by LaxarJS UiKit, although admittedly it does not look quite as pretty:

![LaxarJS ShopDemo using default theme](creating_themes/shop_demo_default_50.png)

**_Above:_ The LaxarJS ShopDemo using the _default_ theme**

### Adding a Theme Using Plain CSS 

Now, since all applications seem to offer a "dark" look these days, let us try to achieve this for our shop demo app.
Fortunately, there are several collections of nice bootstrap themes available for free.
On the site [Bootswatch](http://bootswatch.com) for example, you will find the theme _[darkly](http://bootswatch.com/darkly/)_, which looks like it might work for us.

The only thing that is actually _required_ for a theme to work are a configuration entry and a CSS file in the right place.
Put the pre-built [darkly css](http://bootswatch.com/darkly/bootstrap.css) into the right place, which is `includes/themes/darkly.theme/css/theme.css`.
The path prefix `includes/themes/` may be changed using the RequireJS configuration path `laxar-path-themes`.
In the LaxarJS configuration (usually `application/application.js`), change the property `laxar.portal.theme` from _"default"_ to _"darkly"_.
This causes the LaxarJS runtime to use the new theme.

Because the ShopDemo uses [Font Awesome](http://fortawesome.github.io/Font-Awesome), we need to add an import to the top of our CSS file for that as well:

```CSS
@import url("//maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css");
```

Before opening the application in the browser, make sure to restart the development server, so that the new files are picked up.
And _voilà_, we have a dark web shop:

![LaxarJS ShopDemo using vanilla darkly theme](creating_themes/shop_demo_darkly_50.png)

**_Above:_ The all-new ShopDemo using the _darkly_ theme, hopefully not for any shady business**

Of course, there are still some rough spots that need additional work:
For example, the widget headers look much better using the original laxar demo theme.

Let's fix that using _widget-specific styles:_
The widget styles use a _category/name_ directory structure, similar to that of the actual widgets.
Here are some suggestions for a nicer look, to be put under `widgets/shop_demo`:


* _ArticleBrowserWidget_: `article_browser_widget/css/article_browser_widget.css`

  Here we color the icon, the headline to match the logo, and the currently selected article to match the details widget.

```CSS
/** Customize header and icon color: */
.article-browser-widget h3 i {
  color: #F90;
}

.article-browser-widget th {
  background-color: #F90;
  color: #222222;
}

/** Highlight the selected article. */
.article-browser-widget tr.selected td {
  font-weight: bold;
  background: #3498DB;
}
```


* _ArticleTeaserWidget_: `article_teaser_widget/css/article_teaser_widget.css`

  Here we color the icon and the headline to match the button.

```CSS
/** Customize header and icon color: */
.article-teaser-widget h3 i {
   color: #3498DB;
}

.article-teaser-widget h4 {
   background-color: #3498DB;
   padding: 8px;
}
```


* _ShoppingCartWidget_: `shopping_cart_widget/css/shopping_cart_widget.css`

  Again, we color the icon and the headline to match the button.

```CSS
/** Customize header and icon color: */
.shopping-cart-widget h3 i {
   color: #00bc8c;
}

.shopping-cart-widget th {
   background-color: #00bc8c;
}

/** plus/minus buttons */
.shopping-cart-widget .app-increase-quantity {
   text-align: right !important;
}

.shopping-cart-widget .app-increase-buttons {
   padding: 0;
   padding-top: 6px;
   width: 40px;
}

.shopping-cart-widget .app-increase-buttons button {
   padding: 0;
}
```

Now we have four different CSS files.
Of course, we do not want users to download an additional CSS file for each widget that we use.
Instead, we use `grunt dist` to create a merged version, which we may load through the `index.html`.

![LaxarJS ShopDemo using complete darkly theme](creating_themes/shop_demo_darkly_complete_50.png)

**_Above:_ The all-new ShopDemo using the _darkly_ theme with widget styles. Not too shabby, eh?**

Of course, there are still some problems with this way of styling widgets.
For example, if we would like to change the shade of blue that is used in our theme, we would have to update multiple source code locations.
It would be better to have some way to define these values in our theme and reuse them from individual widgets.  


<a name="creating-an-scss-theme"></a>
### Adding a Theme using Compass/SCSS

To support centralized variables, you can use a _compiles-to-CSS_ language such as [scss/sass](http://sass-lang.com/) or _[less](http://lesscss.org/)_.
At the LaxarJS team we like [Compass](http://compass-style.org/), which is built on top of SCSS.
Fortunately, an SCSS-version of the darkly theme is available, and can be installed using [Bower](http://bower.io/).

Our SCSS theme uses a single central `compass/config.rb` for the theme itself, and for individual widgets.
The `config.rb` has a similar role for SCSS, as the `require_config.js` has for the project's javascript modules: it tells Compass where to find SCSS libraries. 
When compiling widget CSS, the path to the config should be passed on the command line:

```SH
compass compile -c /path/to/shop_demo/includes/themes/darkly_scss.theme/compass/config.rb
```

With the [right config](https://github.com/LaxarJS/shop_demo/blob/master/includes/themes/darkly_scss.theme/compass/config.rb) in place, the [SCSS for our theme](https://github.com/LaxarJS/shop_demo/tree/master/includes/themes/darkly_scss.theme/scss) is little more than a couple of imports.

The advantage is, that we can now write concise widget styles using central variables.
As an example, here is the SCSS file for the _ArticleBrowserWidget_:

```SCSS
@import "variables_all";

.article-browser-widget {

  h3 i {
    color: $app-color-logo;
  }

  th {
    background-color: $app-color-logo;
    color: $body-bg;
  }

  tr.selected td {
    font-weight: bold;
    background: $brand-info;
  }
}

```

Which CSS framework and toolchain to use (if any) is ultimately up to you.
The Bootstrap framework incurs some degree of boilerplate, but makes it relatively easy to reuse widgets across applications, and to find controls that work with your theme out of the box.


## How the Runtime Finds CSS

As mentioned previously, the LaxarJS runtime and grunt tasks do not care how you create your CSS.
However, these tools need to find it.

The general lookup works always like this:

  1. if there are _application specific styles_ for an artifact then use those
  2. else if there are _default styles_ for an artifact then use those
  3. else load _nothing_
  
Of course, _load nothing_ means that it is completely fine for a widget not to have its own CSS styles.
If it was missing an HTML template on the other hand, that would simply be an error.
Following this structure allows the `grunt-laxar` tasks to find and combine the correct HTML and CSS assets, so that the number of HTTP requests may be minimized during production.


### Looking up the Theme CSS

To load the CSS for the theme itself, the portal simply uses the [configured](./configuration.md) theme _X_ and looks for its CSS under `includes/themes/X.theme/css/theme.css`.
The exception is the default theme, which is currently loaded from _laxar_uikit_ (if no user-defined theme is specified).


### Looking up Widget CSS and HTML Templates

For widget CSS styles and HTML templates, the LaxarJS runtime first checks if a version is available within the theme.
This means that you cannot only customize the CSS for a widget _X_ by placing a stylesheet at `<theme>/widgets/category/X/css/X.css` but that you can also override the HTML at `<theme>/widgets/category/X/X.html`.
If nothing is found in the current theme for a given widget, the `default.theme` folder within the widget itself is used.
Do note that CSS and HTML files are treated separately:
You can override the CSS but not the HTML or vice versa.


### Looking up CSS and HTML for a Layout

Themes are intended to be reusable across applications.
Because layouts are highly specific to an application, their CSS and HTML assets are always _within the layout's folder_, for all themes.
Otherwise, the same process as for widgets is used: First, LaxarJS searches the current theme folder, before falling back to the default theme.


### Looking up CSS for a Control

Controls (AngularJS directives) take care of their own HTML loading, so the choice of theme has no effect here.
The styling however is theme specific:
Before looking for the default theme in `<control-require-path>/default.theme/css/<control-name>.css`, LaxarJS looks for a theme specific override in `<theme-path>/<control-require-path>/css/<control-name>.css`.
Here, the `<theme-path>` refers to the folder containing your global theme, and the `<control-require-path>` is the same path that widgets specify in their widget.json to include a control.
Have a look at the [manual on controls](./providing_controls.md) for details. 
