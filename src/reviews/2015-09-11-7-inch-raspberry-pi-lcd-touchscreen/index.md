---
title: "Not recommended for a Raspberry Pi.. or at all."
reviewDate: "2015-09-11"
author: nathan
source: purchased
stars: 2
reviewId: R4MLPOO8XP9WQ
reviewUrl: "https://amazon.com/gp/customer-reviews/R4MLPOO8XP9WQ"
product:
  name: 7 inch 800×480 Capacitive Touch Screen HDMI Interface Custom Raspbian LCD Monitor Mini PC Supports Raspberry Pi 4 3 2 1 Model B B+ A+ & BeagleBone Black & Banana Pi/Banana Pro @XYGStudy
  url: "https://www.amazon.com/dp/B00XUAIP9K"
  title: "7 inch 800×480 Capacitive Touch Screen HDMI Interface Custom Raspbian LCD Monitor Mini PC Supports Raspberry Pi 4 3 2 1 Model B B+ A+ & BeagleBone Black & Banana Pi/Banana Pro @XYGStudy"
images:
  product: product.jpg
  photos:
    []
tags:
  - tech
  - display
  - raspberry-pi
---
Works, but not well. I think the main problem is that it draws too much power. If I have only a keyboard and this display connected, then I get a picture (usually). But if I try to also add a wi-fi module, the screen starts flickering on and off, and the lights on the keyboard do the same. This is with a fairly beefy 2.5A power supply from a cana kit. If I connect the display to external power, then it works (Although there's no chance of getting the touchscreen to work then. I actually never got the touchscreen to work, I just gave up on it.)

Also, linux defaulted it to the wrong resolution. That's probably an easy fix, but I didn't bother with it. (Update: it wasn't exactly easy, but I did figure it out. Details at the end.)

I connected it to my Macbook for kicks and the screen was recognized but it also defaulted to the wrong resolution. That was an easy fix, I just changed the setting from Scaled to "Default for this monitor".. not sure why OS X picked Scaled, maybe because it wanted to mirror my displays by default. The touchscreen didn't work there either.

If you're looking at it straight on, the colors and contrast are surprisingly decent. And moving left or right doesn't really change things - the horizontal viewing can go to almost 180 degrees. However the vertical viewing angle is awful. There's about a 5-10 degree sweet spot, and beyond that it gets progressively worse with a "useable" range of maybe 30 degrees. But that's about par for the course with cheep TN panels.

As others have mentioned, the box includes a burned DVD that presumably has drivers.. but I don't have anything to read DVDs handy. A download option would be much appreciated.

Update: I did figure out the display settings to have it use the correct resolution on a Raspberry Pi: You have to edit /boot/config.txt (`sudo nano /boot/config.txt`), and first delete/comment anything that NOOBS may have added to the end of the file. Then add this line:

hdmi_cvt=800 480 60

Everything else in the file can be left commented out.

That's based on the "documentation" at https://www.raspberrypi.org/forums/viewtopic.php?f=29&t=24679 I think it's Raspbian-specific, but feel free to try it out on other systems.
