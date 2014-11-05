[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)


# Events and Publish/Subscribe

The key concept that distinguishes LaxarJS applications from other AngularJS applications is the _publish-subscribe_ (or _pub/sub_) architecture.
It helps to isolate building blocks such as widgets and activities by moving the coupling from implementation (no module imports, no service contracts) to configuration (of event topics).

LaxarJS consistently uses the term _events_ rather than _messages_, to point out two key aspects of its event architecture:
 * events convey information about _what happened_ (rather than _who is receiver_)
 * delivery is always _asynchronous_ (using an _event loop_)

Due to the latter, you may also think of this pattern as a variation on the _hollywood principle_ ("Don't call us, we'll call you").

For efficient processing, LaxarJS ties into the AngularJS `$digest`-cycle.
This allows the web browser to batch event-handling with other operations that modify screen contents.


## The Event Bus

All events are published to and delivered by the _event bus_:
The event bus manages _name-based_ (or _topic-based_) _event subscriptions_ for all interested widgets and activities (the _subscribers_):
Subscribers specify an event name pattern that tells the event bus which kinds of "thing that happened" they are interested in.
When an event is published to the event bus, it is kept in an event queue, to be delivered asynchronously.
During event delivery, each event name is matched against each subscription, and each matching event is delivered by running the associated callback.

Each event has a _name_ containing a summary of what happened, and a _payload_ carrying additional information.

### Event Names

Event names summarize _what happened_, possibly with some additional context.
They follow a hierarchical structure that is used to pattern-match against subscriptions during delivery.

An event name is a string, formed by a sequence of one or more _topics_ that are separated by `.` (the full stop, U+002E).
Each topic is a string, made up from a sequence of one or more _sub-topics_ separated by `-` (the hyphen-minus, U+00AF).
Sub-Topics are strings, formed by

  * _either_ an upper case letter followed by a sequence of upper case letters and numbers
  * _or_ a lower case letter followed by a sequence of mixed case letters and numbers

These rules also exist as a formal [grammar](#grammar) for thorough people.

These are examples for _valid_ event names:

  * `didReplace.myShoppingCart`
  * `takeActionRequest.searchArticles`
  * `didTakeAction.searchArticles.SUCCESS`
  * `willEndLifecycle`
  * `didValidate.popup-user2`

_Invalid_ event names include:

  * `DidReplace.myShoppingCart`: _invalid,_ first topic starts upper case but contains lower case letters
  * `.searchArticles.SUCCESS`: _invalid,_ empty topic is not allowed
  * `didUpdate.1up`: _invalid_, topic must not start with a number

#### Naming Best Practices and Event Patterns

Good event names start with a very general _verb-based first topic_, broadly describing _what_ happened.
That topic is often followed by a more specific _object-based second topic_, describing _where_ (or _to what_) something happened.
Sometimes, this second topic is broken down into sub-topics that allow to "zoom in" on the event details.
For example, the event _didValidate.popup-user2_ informs all interested subscribers, that the second user has been validated by a widget _within a popup_.
This information can now be used to show validation messages at the appropriate location.
Sometimes there is a _modal third topic_, broadly describing _how_ something happened (e.g. to communicate an outcome such as `SUCCESS` or `ERROR`).

Of course, nothing prevents senders to break these rules and use any structure for their event names as long as they conform to the grammar. 
But for best interoperability between widgets and activities, not only should the general structure of event names be observed.

It is recommended wherever possible for widgets to use one or more of the established _event patterns_:
These patterns consist of event vocabularies and minimal associated semantics that have been identified during the development of LaxarJS.
A few [core patterns](core-patterns) are baked right into the LaxarJS runtime, and these are listed below.
Other useful patterns are described in the separate project _[LaxarJS Patterns](//github.com/LaxarJS/laxar_patterns)_.
Even without using the LaxarJS Patterns _library_, widget authors are very much encouraged to use the [event vocabularies](//github.com/LaxarJS/laxar_patterns/docs/index.md) whenever meaningful. 


### Event Payload

An event does not only have a name, but also a _payload_. 
Any JavaScript object that can be directly represented as [JSON](http://json.org/) can be used as a payload.
This allows for the object to contain instances of _string_, _array_, _number_, _boolean_ and _object_, including `null`. 
On the other hand, it excludes`undefined`, _Date_, _RegExp_ and custom classes.

The Event Bus will _create a copy_ of the payload _for each subscriber_ that gets the event delivered.
This improves decoupling and robustness, because events are "fire and forget": 
A widget may publish some resource through an event and afterwards immediately modify its contents, but all subscribers are guaranteed to receive the original event.

However, this also means that you should only publish resources that are at most ~100 kilobyte in size.
For larger resources, it is recommended to only transfer a URL so that interested widgets may receive the content from a server (or the browser cache).


<a name="request-events"></a>
### Request and Response using the Request/Will/Did Mechanism 

Sometimes a widget has to request for some other widget or activity on the page to perform some action.
This might be a longer running action such as a search or some server side validation.
The requesting widget does not care about _who_ actually performs the request, but it is interested in _when_ the request has been fully processed by all respondents, and what is the outcome.

As an example, consider a multi-part user sign-up process, where each of the several widgets allows the user to enter and validate some of the information such as E-Mail Address, payment information and a CAPTCHA.
Another widget offering a _Complete Registration_ button would be responsible for the overall process of submitting the registration resource to a REST service and navigating to a different page.   
Before hitting the registration service, this widget would ask all input widgets to validate their respective validation details in order to provide immediate feedback to the user.
Some of the widgets might have to query their own validation services though, such as the CAPTCHA widget.

With the _Request/Will/Did_ mechanism such a scenario can be achieved without the registration widget having to know any of the participant widgets:

1. The individual widgets have been _configured_ (through the page definition) to work with a `"registrationForm"` resource.
   The input widgets that offer validation subscribe to `"validateRequest"` events related to this resource in order to support validation.

2. When the user activates the _Complete Registration_  button, the registration widget issues a `"validateRequest.registrationForm"` event, indicating that
  
  * a validation has been requested (_what happened_) and
  * it concerns the resource _"registrationForm"_ (_where_ it happened).
  
  The registration widget may now disable its button and start showing an activity indicator to help the user recognize that an action is in progress.

3. During delivery, the input widgets supporting validation will publish a `"willValidate.registrationForm"` event to indicate that

  * a validation has started (_what_) and
  * that it concerns the `"registrationForm"` resource (_where_).
  
4. Each of the widgets will either call its registration service to respond asynchronously, or publish a response directly if it can be computed locally and quickly.
   The response has the form `"didValidate.registrationForm.SUCCESS"` or `"didValidate.registrationForm.ERROR"` conveying that
   
  * a validation has been performed (_what_) and
  * that it concerns the `"registrationForm"` resource (_where_) and
  * the way the validation turned out (_how_).

4. Once all responses have been gathered and there were no validation errors, the registration form will be notified (through a promise) and the REST request may be performed.

The most important property of this mechanism is that any of the widgets on the page may be removed or replaced without any of the other widgets having to know.
New widgets may be added at any time, and will work as long as they support the validation pattern.
Even if not, they might still be used, and their validation would be handled by the server upon submission of the registration form.
Another widget could be added to gather and display validation messages to the user, simply by hooking it up to the same resource and processing its `"didValidate"` events.

Validation and other patterns are described in the [pattern reference](#pattern-reference) below.


<a name="pattern-reference"></a>
## Pattern Reference

A few event patterns are supported directly by LaxarJS, while others are described in the _LaxarJS Patterns_ library.
Have a good look at all of them before coming up with your own patterns, in order to maximize the synergy of your widgets, especially when aiming for reuse.

### Core Patterns

TODO

#### Page Life Cycle

TODO

#### Navigation

TODO

#### Locales and i18n

TODO

#### Themeing, Visibility and  Layout


### More Patterns

The patterns described so far are used mainly for widgets to interact with the LaxarJS runtime.
For application patterns that help widgets to interact with each other, refer to the [LaxarJS Patterns documentation](//github.com/LaxarJS/laxar_patterns/docs/index.md).


## Event Reference


### The Event Bus API

The event bus is available to widgets and activities through `$scope.eventBus`.
It only has a few essential methods that allow to implement all patterns described below.

* `subscribe( eventPattern, callback, options )`

  This creates a subscription on the event bus.
  The `eventPattern` is a prefix for events to subscribe to: 
  Events that start with the given sequence of (sub-)topics will be handled by this subscription.

* `publish( eventName, payload )`

  Publishes an event to all interested subscribers.
  Delivery is asynchronous: control is returned to the caller immediately, and delivery will be performed afterwards, together with an AngularJS digest cycle.
  The event payload is cloned immediately so that the caller is free to modify it right after publishing.
  Returns a promise that is resolved after the event has been delivered to all subscribers.

* `publishAndGatherReplies( requestEventName, payload )`

  Publishes a [request event](#request-evens), gathers all _will_-responses during delivery and then waits for all outstanding _did_-responses.
  Returns a promise that is resolved when all _did_-responses have been received.


TODO

<a name="grammar"></a>
### Event Grammar

This is the formal grammar for events:

TODO