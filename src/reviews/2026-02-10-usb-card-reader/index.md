---
title: "Convenient but slow"
reviewDate: "2026-02-10"
orderDate: "2026-01-31"
author: nathan
source: vine
stars: 4
video: video.mp4
reviewId: R1H82HU4I6OXQL
originalUrl: "https://amazon.com/gp/customer-reviews/R1H82HU4I6OXQL"
product:
  name: USB card reader
  title: "USB C USB A Sim Card Reader Smart Card Reader, 6 in 2 CAC Reader DOD Military/SIM/SD/TF/MS Pro Duo/M2/ID/IC/PIV Card, SIM Card Reader for Windows,Linux,MacOS"
  price: 15.99
  url: "https://www.amazon.com/dp/B0G4R5123H"
tags:
  - tech
  - usb
  - adapter
---
This card reader covers a range of different types of cards, and the option of USB-A or USB-C is convenient. However, it DOES NOT operate at a "10 Gigabits Per Second" Data Transfer Rate - that's just plain false advertising.

It actually operates at USB 2.0 speeds. The SD card and microSD card readers operate at ~21 megabytes per second (with a Samsung EVO Plus 512GB microSD that can go several times faster in a different card reader).

Additionally, the microSD and SD reader cannot work at the same time - it's one or the other. If you try to use both, the full-sized SD card will win and the microSD will be ignored.

I don't have any cards to test the Memory Stick & M2 ports, but my guess is that they are also shared with the SD and microSD reader and only one of the four can be used at a time.

The smart card reader works - I put a card in and it showed up in the windows Device Manager as an "Unknown Smart Card".

I was not able to test the SIM card reader only supports the older full-sized cards, not micro or nano sims that are more common today. DO NOT try to put a smaller one into the reader, it's a huge pain to get out.

The light turns green when a card is inserted and blinks red when it is reading or writing.

Here's the tree as reported as USB Device Tree Viewer:

Realtek USB2.0-CRW USB Composite Device

|---Microsoft Usbccid Smartcard Reader (WUDF)

| \---Smart card filter driver

\---USB Mass Storage Device

\---Generic- Multi-Card USB Device - Disk drive - Disk1 - no media

\---Volume - no media

<figure>
  <video controls preload="metadata" poster="poster.jpg" style="max-width:100%;height:auto">
    <source src="video.mp4" type="video/mp4">
    Your browser doesn't support this video. <a href="video.mp4" download>Download the video</a>.
  </video>
</figure>
