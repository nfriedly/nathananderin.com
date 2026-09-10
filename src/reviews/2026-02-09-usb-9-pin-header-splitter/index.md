---
title: "Splits 1 port 4 ways, ignores the other port"
reviewDate: "2026-02-09"
orderDate: "2026-01-23"
author: nathan
source: vine
stars: 4
reviewId: R35ZF00YX013T4
reviewUrl: "https://amazon.com/gp/customer-reviews/R35ZF00YX013T4"
product:
  name: USB 9-pin splitter
  price: 9.99
  url: "https://www.amazon.com/dp/B0GBTNW415"
  title: "IYUANEPRO USB 2.0 9Pin to Dual 9Pin Splitter Adapter, Motherboard Header Expansion Hub, 1 to 2 Port Converter"
images:
  product: product.jpg
  photos:
    - photo-1.jpg
    - photo-2.jpg
    - photo-3.jpg
    - photo-4.jpg
tags:
  - tech
  - computer
  - usb
---
Works, but the implementation is sub-par from a bandwidth perspective. Each 9-pin header on the motherboard is actually two USB ports, so this splitter, going from one 9-pin to two 9-pin headers is really going from 2 USB ports to 4 USB ports. You might naively expect that to mean that each port gets half the bandwidth, but in fact one of the ports on the motherboard isn't even used, and the other one is split 4 ways. Splitting 2 and 2 would require a second USB hub chip, but splitting 1:3 and then passing the other port through directly would just need 4 extra traces on the motherboard.

That said, this is USB 2.0, and if you actually needed high bandwidth you'd use a USB 3.0 or newer port. So, it probably doesn't matter in practice.

The other thing to be aware of is that the Y-shape of this splitter means that it's partially covering the ports on either side of it. This didn't turn out to be a problem in my case, but it could be in yours.

Summary from USB Device Tree Viewer:

Vendor ID : 0x1A86 (Nanjing Qinheng Microelectronics Co., Ltd.)

Product ID : 0x8095

Manufacturer String : ---

Product String : "USB Hub"

Serial : ---

USB Version : 2.0 (480 Mbit/s)

Port maximum Speed : High-Speed

Device maximum Speed : High-Speed

Device Connection Speed : High-Speed

Self powered : yes

Demanded Current : 100 mA

![review photo 1](photo-1.jpg)

![review photo 2](photo-2.jpg)

![review photo 3](photo-3.jpg)

![review photo 4](photo-4.jpg)
