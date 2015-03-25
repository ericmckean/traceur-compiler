# Git Work Flow #

First check out the code as described at http://code.google.com/p/traceur-compiler/source/checkout.

We use Depot Tools from the Chromium project to simplify code reviews. Install it and make sure you have it in your path. Please follow the instructions at: http://dev.chromium.org/developers/how-tos/install-depot-tools

One easy work flow is to create one branch per patch/feature.

```
git checkout -b my-new-branch
```

Make changes to your branch.


Once you are ready to have the code reviewed you use `git cl upload`. To upload a new patch you need to have committed all changes locally.

```
git commit
```

Once you have committed all changes locally

```
git cl upload
```

This will prompt you to enter a description etc. Please describe the change and link to the bug number and list the tests you added.

```
Fix interface issue with HTMLBlockquoteElement

BUG=http://code.google.com/p/traceur-compiler/issues/detail?id=59
TEST=features/Classes/HTMLBlockquoteElement.js
```

Once uploaded go to the issue at http://codereview.appspot.com/. The full URL should be visible in the terminal window. At the issue page add a reviewer and mail them. The easiest way is probably to just hit "Publish+Mail comments" and type in the email address of the reviewer.

Once you are done making changes based on the review you just `git cl upload` again.

Once the reviewer has LGTM'd the patch and if you are a committer then you can commit your changes using

```
git cl push
```

This will update the code review site as well as commit the code.

If you are not a reviewer you can ask the reviewer to submit the patch for you. Remember to read AddingTransformationPasses#Contributions which contains more info.