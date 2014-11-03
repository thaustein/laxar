[« return to the manuals](index.md)

Preliminary readings:

* [LaxarJS Core Concepts](../concepts.md)


# Events and Publish/Subscribe

The key concept that distinguishes LaxarJS applications from regular AngularJS applications is the _publish-subscribe_ (or pub/sub) architecture.
It allows to isolate application building blocks (widgets and activities) by moving coupling from implementation (no module imports, no service contracts) to configuration (of event topics).   

LaxarJS consistently uses the term _events_ rather than _messages_, to point out two key aspects of its event architecture:
 
 * event topics carry information about _what happened_ (rather than _who is the audience_)

 * delivery is always _asynchronous_ (using an _event loop_)

For efficient processing, LaxarJS ties into the AngularJS `$digest`-cycle.
This allows the web browser to batch event-handling with other operations that modify screen contents.

TODO:
* hollywood principle


## The Event Bus

All events are published to and delivered by the _event bus_:
The event bus manages _name-based_ (or _topic-based_) _event subscriptions_ for all registered widgets and activities (_subscribers_):
Subscribers specify an event name pattern that tells the event bus which kinds of "thing that happened" they are interested in.
When an event is published to the event bus, it is stored in an event queue, to be processed asynchronously.
During event processing, each event name is matched against each subscription, and each matching event is delivered by running the associated callback.
