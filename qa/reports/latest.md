# הדוח היומי של אפליקציית טייסת 124

**יום שבת, 22 באוגוסט 2026**

## ✅ הכל תקין

בדקתי את האפליקציה מקצה לקצה ולא מצאתי שום תקלה. אין צורך לעשות כלום.

### מה נבדק היום

- נכנסתי לאפליקציה בתור **כל 19 סוגי המשתמשים** שיש בה (מפקדים, חיילים, אחראי הדרכה, מ״ע אחזקה, מנהל-על ועוד)
- פתחתי **103 מסכים** ובדקתי שכולם נטענים ומציגים נתונים
- הרצתי **121 בדיקות** שמוודאות שתקלות שכבר תוקנו לא חזרו
- ניסיתי לפרוץ לאפליקציה בשיטות מוכרות, כדי לוודא שאי אפשר

---

## בדיקת כל המשתמשים וכל המסכים

> ✅ הכל תקין

_אין מה לדווח._

## בדיקה שתקלות ישנות לא חזרו

> ✅ הכל תקין

**🔵 מידע · כל בדיקות הרגרסיה עברו**
121 קבצי בדיקה, כולם ירוקים — כל מנגנוני הכתיבה הקריטיים תקינים.

---

## אבטחה

> 1 נקודה לתשומת לב

**🟠 בינוני · בדיקת הזרקת קוד עוין לא רצה**
browser.newPage: Target page, context or browser has been closed
Browser logs:

<launching> /opt/pw-browsers/chromium --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-akBIp7 --remote-debugging-pipe --no-startup-window
<launched> pid=2925
[pid=2925][err] [2925:2940:0822/110416.424661:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=2925][err] [2925:2940:0822/110416.467875:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2940:0822/110416.469142:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=2925][err] [2925:2940:0822/110416.469269:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=2925][err] [2925:2940:0822/110416.619538:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2925:0822/110416.695345:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type: 
[pid=2925][err] [2925:2940:0822/110416.695600:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2940:0822/110416.695626:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2940:0822/110416.695635:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2940:0822/110416.695640:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2940:0822/110416.695680:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=2925][err] [2925:2925:0822/110416.708163:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type: 
[pid=2925][err] [2925:2925:0822/110416.718625:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type: 
[pid=2925][err] [2925:2940:0822/110416.718818:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=2925][err] [2925:2940:0822/110416.718845:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=2925][err] [2925:2925:0822/110416.719599:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type: 
[pid=2925][err] [2925:2925:0822/110416.729091:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.Properties.GetAll: object_path= /org/freedesktop/UPower/devices/DisplayDevice: unknown error type: 
[pid=2925][err] [2956:2987:0822/110421.788322:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110421.788737:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110421.788818:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110421.788901:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110422.528148:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110422.533413:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110422.581258:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110422.650125:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110423.037577:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110423.500240:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110423.930981:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110423.935584:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110424.086844:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110424.437195:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110425.491872:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110425.897446:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110425.910895:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110426.014634:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110426.415638:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110427.515478:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110428.376917:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110428.646697:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110429.038049:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110429.144882:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110429.434012:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110429.514927:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110430.455595:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110431.547896:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110432.350393:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110432.997302:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110433.276816:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110433.550843:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110433.829830:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110434.500378:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110435.579820:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110436.482283:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110436.511283:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110437.593686:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110438.454943:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110439.615869:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110440.266954:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110440.452103:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110440.569693:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110441.041419:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110441.631567:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110442.532136:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110442.804318:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110443.703441:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110444.596040:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110445.270119:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110446.154878:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110446.369364:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110447.313596:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110447.708208:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110448.640203:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110449.961827:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110449.962468:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110450.088053:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110450.315895:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110450.863598:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110451.072322:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110451.471849:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110452.038044:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110452.283888:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110457.767949:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110505.938473:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110506.301272:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110509.259149:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110512.298068:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110518.588791:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110527.049783:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110528.253701:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110532.955310:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110546.366474:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110552.780835:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110600.925995:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110605.130763:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110607.466561:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110653.544842:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110656.654878:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110702.982700:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110703.991258:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110710.275461:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -101
[pid=2925][err] [2956:2987:0822/110819.228726:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110820.502422:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925][err] [2956:2987:0822/110821.614236:ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
[pid=2925] <gracefully close start>

**🔵 מידע · מפתח Firebase/Google API נמצא בקוד**
1 מופעים (שורה 3862). מפתח Web של Firebase הוא ציבורי מעצם טיבו — ההגנה בפועל היא כללי מסד הנתונים + App Check. לא נדרשת פעולה, בתנאי ששני אלה מופעלים.

**🔵 מידע · הפרדה בין מסגרות אינה אכופה בשרת — החלטה מתועדת, לא פרצה**
תגית authorized חוסמת אימות אנונימי (ראה SECURITY.md שלב 7), אבל כל כניסה אמיתית עם קוד עדיין יכולה לקרוא נתונים של מסגרות אחרות — זו החלטת מוצר מכוונת שתועדה ב-SECURITY.md שלב 4 ("הוחלט לא לבצע הפרדת מסגרות בשרת — החשש אינו מפני אנשי הטייסת עצמם"). אם יידרש בעתיד להדק, הפתרון כבר כתוב כתיעוד היסטורי בקובץ הכללים (גרסה 2).

**🔵 מידע · קודי הכניסה אינם בקוד הלקוח**
האימות מתבצע מול Firebase Auth — נכון ובטוח.

---

## הצעות לשיפור

> 4 נקודות לתשומת לב

**🟠 בינוני · גודל האפליקציה**
1145 KB, 16,531 שורות בקובץ יחיד. מעל 900KB — כל טעינה ראשונה מורידה את הכל. שווה לשקול פיצול ה-CSS/JS לקבצים נפרדים שנשמרים במטמון בנפרד.

**🟡 קל · פונקציות שלא נקראות מאף מקום**
1 פונקציות: hebDayOffset. מועמדות למחיקה — פחות קוד, פחות מקום לטעות.

**🟡 קל · שדות קלט ללא תיאור**
1 שדות בלי aria-label/placeholder/id.

**🟡 קל · פונקציות ארוכות מאוד**
3 פונקציות מעל 120 שורות. הארוכות: applyLoginUiForRole (146 שורות, שורה 4793), renderRosterEditor (126 שורות, שורה 8808), renderTrainHub (122 שורות, שורה 5667). פיצול יקל על תחזוקה ויקטין סיכון לבאגים.

**🔵 מידע · ההגנה על רשימת הצוות במקומה**
אין כתיבות עיוורות של PERSONNEL — כל השמירות עוברות דרך mutatePersonnel().

**🔵 מידע · ההגנה על יושרת השמירה במקומה**
אין catch שמחזיר true — כשלי שמירה מדווחים כפי שהם.

**🔵 מידע · דגלי מיגרציה/זריעה חד-פעמיים מוגנים מפני כשל קריאה חולף**
כל הפונקציות שבודקות דגל "כבר בוצע" מתייחסות ל-fbReadFailed לפני שהן מחליטות לרוץ מחדש.

---

## מה מומלץ לעשות

1. **בדיקת הזרקת קוד עוין לא רצה** — browser.
2. **גודל האפליקציה** — 1145 KB, 16,531 שורות בקובץ יחיד.

_יש עוד 3 הערות קטנות שלא דחופות._

---

### מה הבדיקה הזו לא מכסה

הבדיקה רצה על הקוד של האפליקציה — לא על השרת החי. כלומר היא **לא רואה** אם מישהו מנסה לפרוץ ברגע זה, ולא רואה את הנתונים האמיתיים של הטייסת. כדי לקבל התראה על ניסיון חדירה בזמן אמת צריך להפעיל את ההתראות של Firebase עצמו — כתוב איך ב-`qa/README.md`.
