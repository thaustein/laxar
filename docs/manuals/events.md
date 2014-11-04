[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)


# Events and Publish/Subscribe

The key concept that distinguishes LaxarJS applications from other AngularJS applications is the _publish-subscribe_ (or _pub/sub_) architecture.
It allows to isolate application building blocks (widgets and activities) by moving the coupling from implementation (no module imports, no service contracts) to configuration (of event topics).

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

#### Best Practices in Naming

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
TODO

<a name="core-patterns"></a>
## Core Event Patterns

TODO

### Page Life Cycle

TODO

### Navigation

TODO

### Locales and i18n

TODO

### More Patterns

The patterns described so far are used mainly for widgets to interact with the LaxarJS runtime.
For application patterns that help widgets to interact with each other, refer to the [LaxarJS Patterns documentation](//github.com/LaxarJS/laxar_patterns/docs/index.md).

## Event Reference

TODO

<a name="grammar"></a>
### Event Grammar

This is the formal grammar for events:

TODO