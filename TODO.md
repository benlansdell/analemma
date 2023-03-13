TODO:

* Change camera selection/angle issues
* Add correct precession amounts for other planets. I think I know how to do it exactly now... look up other planet's "rotation elements"
* Make rate of rotation depend on planet selected
* Make eot depend on duration of selected planet's day -- this is just a scale
factor 

DOING

* Just plot the whole trail at once, whenever parameters are updated

DONE

x Clean up code
x Add estimate of duration of solar day
x Add Small points where solitices, etc, are. Hard to figure out exactly where it's claiming it takes place.
x Small bug with changing eccentricity -- soltices, etc are put in wrong spot
x Bug where lines disappear when most of it is out of frame
x Draw analemma in bottom left of screen?
x Bug? EOT magnitudes seem wrong for earth parameters. Off by factor of 2?
x Make labels for solstices, etc
x Also, make trails freq depend on number of days in year
x Add some ambient lighting so we can see earth even when in shadow
x Currently: solstice and perihelion occur at same time... need to rotate earth's axis so that it occurs
  on Dec 21st. Make it so we can precess as desired
x Add multiplier for number of days in year... otherwise too slow for planets with long years
x What to do about planets with retrograde rotations?
  Take these out...along with one's whose obliquity is too small/large to give good analemma
x Make draw trails toggle button work
x BUG: equation of time text glitches and flickers to the wrong time, every so many frames
x Fix text issues: why do labels disappear?
x Add a set to Earth's parameteres button
x Add a pause button
x Refine camera modes
x Draw trails behind apparent sun -- so it draws the analemma
x Turn moon off...
x Make one camera mode be at center of earth (turn earth and moon off)
x Highlight EOT
x Show text -- the day, month, etc, and the eot
x Add option to change obliquity of earth
x Label parts of the orbit -- perihelion, aphelion, solstice, equinox, etc.
x Make it so we can select which object we use as the center
x How to display the mean sun ??
x Display celestial sphere, equator and ecliptic?
x A plane/circle that indicates solar noon
x A plane that indicates mean solar noon (e.g. equation of time)
x Make it so we can adjust the analemma shape
x Make window smaller -- want this to fit in to the page we're drawing. 
x Make it so I can change earth's orbit
x Make controls display how fast we're moving -- time/time
x Change orbits to ellipses -- actual ellipses, following Kepler's law
x Make sizes to scale?
x Make background dynamic
x Only include earth and sun
x Add a limit to how far we can scroll out
