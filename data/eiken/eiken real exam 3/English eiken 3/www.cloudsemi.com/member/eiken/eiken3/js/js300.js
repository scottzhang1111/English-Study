// JavaScript Document
// 制限秒数
var timer = 300;

function countdown() {
	if (timer == 0) {
		document.qform.submit();
	}
	
	var min = parseInt((timer / 60) % 60);
	var sec = timer % 60;
	if (min < 10) { min = "0" + min; }
	if (sec < 10) { sec = "0" + sec; }
	if (sec < 0) { sec = 0; }
	document.qform.m.value = min;
	document.qform.s.value = sec;
	
	window.setTimeout("countdown()", 1000);
	timer--;
}
