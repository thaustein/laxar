# Contributing to LaxarJS

Thank you very much for your interest in becoming active in the support and the improvement of LaxarJS!
We are very much looking forward to your contribution, whether it is a bug report or a pull request.


## Code of Conduct

The [AngularJS Code of Conduct](https://github.com/angular/code-of-conduct/blob/master/CODE_OF_CONDUCT.md) covers pretty well what we would like to see from anyone contributing to the LaxarJS project.
The TLDR: _be respectful and be nice._


## How to Get in Touch

If you have a problem using LaxarJS, but you are not sure if it is a bug, or if you are generally looking for help in using LaxarJS, head to our [IRC channel](http://webchat.freenode.net/?channels=laxarjs).


## Report a Bug

Please [file an issue](https://github.com/LaxarJS/laxar/issues/new) to the LaxarJS repository.
Make sure to mark it as a _bug_ by activating the corresponding label.
It is very much appreciated if you could add the specific LaxarJS version where you observed the bug to the beginning of the title field.
Also, if the problem occurs only on a specific platform, that should be stated prominently.
For example: `v0.21.1: cannot navigate when using option foo-bar in Internet Explorer 9`.


## Request a Feature

The process is similar to reporting a bug: [open an issue](https://github.com/LaxarJS/laxar/issues/new) with label _enhancement_ and describe your desired feature, specifying the LaxarJS version that is missing the feature.
Example: `v0.22.0: LaxarJS should be able to load React-based widgets and controls`


## Submit a Contribution

If you have been able to solve a problem or add a desirable feature, first of all: _Kudos_ to you!
We might be able to incorporate your change through a pull request.
We have set up a basic contribution process outlined below.
It covers simple typing mistakes in our documentation, bug fixes and performance optimizations as well as completely new features.
Do not be put off by any of the steps if they seem daunting -- get in touch and we will try to work through them together.


### Get in Touch

Before preparing any major contribution, you are encouraged to get in touch either by filing an issue (preferred, see above), by [email](info@laxarjs.org) or through [IRC](http://webchat.freenode.net/?channels=laxarjs).
We can never guarantee that your contribution will enter the codebase without modification (or at all for that matter), but getting in touch significantly improves that chance.


### Sign the Contributor Agreement

For legal reasons, we have to obtain a signed contributor agreement in writing before accepting pull requests or patches from you. 
For this we rely on the [Framework Agreement](http://www.tossca.org/wp-content/uploads/2015/01/Frame-Agreement-TOSSCA-0.7.pdf) ([German version](http://www.tossca.org/wp-content/uploads/2015/01/Rahmenvertrag-TOSSCA-0.7.pdf)) by the non-profit [TOSSCA association](http://www.tossca.org).


### Create a Pull Request

Fork our repository and create a feature-branch that contains your change.
Here are some tips for preparing your contribution:

 * Try to emulate the basic coding style of the LaxarJS codebase:
   - indent with three spaces
   - use whitespace within braces and brackets, but not after keywords: use `if( x )` rather than `if (x)`
   - avoid abbreviated identifiers
   - wrap at 120 characters.
 * Document public API methods with JSDoc.
 * Add spec-tests for new features as well as for bug fixes.
 * Your commit message should contain the issue number like this: `(#12345) flow: fixed handling of long URLs`, allowing GitHub to generate links.
 * Use `git rebase` to create a single commit (usually against the `master` branch).
 * Make sure that your spec tests work by running `npm install` and `npm test` in the LaxarJS project.

We will try yo preserve your commit as is in the LaxarJS history, but naturally we reserve the right to make changes if appropriate, for example to rebase your change onto a more recent master branch, or to fix coding style issues.
Naturally, we will likely make additional changes to your contribution in subsequent commits.
In any case, your authorship will be preserved in the LaxarJS commit history.
