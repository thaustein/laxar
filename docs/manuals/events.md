[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)


# Events and Publish/Subscribe

The key concept that distinguishes LaxarJS applications from other AngularJS applications is the _publish-subscribe_ (or pub/sub) architecture.
It allows to isolate application building blocks (widgets and activities) by moving the coupling from implementation (no module imports, no service contracts) to the configuration (of event topics).

LaxarJS consistently uses the term _events_ rather than _messages_, to point out two key aspects of its event architecture:
 
 * events convey information about _what happened_ (rather than _who is receiver_)

 * delivery is always _asynchronous_ (using an _event loop_)

So you can think of this pattern as a variation on the _hollywood principle_ ("Don't call us, we'll call you").  

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

Event names summarize _what happened_.
They have a hierarchical structure that is used to pattern-match against subscription during delivery.

The name is a string, formed by a sequence of one or more _topics_ that are separated by `.` (the full stop, U+002E).
Each topic is a string, formed by a sequence of one or more _sub-topics_ that are separated by `-` (the hyphen-minus, U+00AF).
Sub-Topics are strings, formed by

  * _either_ an upper case letter followed by a sequence of upper case letters and numbers
  * _or_ a lower case letter followed by a sequence of mixed case letters and numbers

These are valid event names:

  * `didReplace.myShoppingCart`
  * `didTakeAction.searchArticles.SUCCESS`
  * `validateRequest.popup-userName`
  * `willEndLifecycle`

Good event names start with a very general verb-based topic, broadly describing the kind of thing that happened.
That topic is often followed by a more specific object-based topic, describing where this thing happened.
Sometimes, this second topic is broken down into sub-topics that allow to "zoom in" in on the relevant  

Of course, nothing prevents senders to break these rules and use any event name. but as interpretation of events is completely up to the receiver

### Event Payload


## Builtin Event Patterns

### Page Life Cycle

### Navigation



