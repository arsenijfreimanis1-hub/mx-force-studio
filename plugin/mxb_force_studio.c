/**
 * MX Bikes output plugin → Force Studio UDP JSON.
 *
 * Copy the built .dlo into the MX Bikes plugins folder.
 * Default target: 127.0.0.1:47387  (override in plugins/force_studio.ini)
 *
 * Build (MinGW-w64):
 *   x86_64-w64-mingw32-gcc -shared -O2 -o mxb_force_studio.dlo mxb_force_studio.c -lws2_32
 */

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <math.h>
#include <stdio.h>
#include <string.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#pragma comment(lib, "ws2_32.lib")

#ifdef __cplusplus
extern "C" {
#endif

__declspec(dllexport) char *GetModID(void)
{
	return "mxbikes";
}

__declspec(dllexport) int GetModDataVersion(void)
{
	return 8;
}

__declspec(dllexport) int GetInterfaceVersion(void)
{
	return 9;
}

typedef struct
{
	char m_szRiderName[100];
	char m_szBikeID[100];
	char m_szBikeName[100];
	int m_iNumberOfGears;
	int m_iMaxRPM;
	int m_iLimiter;
	int m_iShiftRPM;
	float m_fEngineOptTemperature;
	float m_afEngineTemperatureAlarm[2];
	float m_fMaxFuel;
	float m_afSuspMaxTravel[2];
	float m_fSteerLock;
	char m_szCategory[100];
	char m_szTrackID[100];
	char m_szTrackName[100];
	float m_fTrackLength;
	int m_iType;
} SPluginsBikeEvent_t;

typedef struct
{
	int m_iSession;
	int m_iConditions;
	float m_fAirTemperature;
	char m_szSetupFileName[100];
} SPluginsBikeSession_t;

typedef struct
{
	int m_iRPM;
	float m_fEngineTemperature;
	float m_fWaterTemperature;
	int m_iGear;
	float m_fFuel;
	float m_fSpeedometer;
	float m_fPosX, m_fPosY, m_fPosZ;
	float m_fVelocityX, m_fVelocityY, m_fVelocityZ;
	float m_fAccelerationX, m_fAccelerationY, m_fAccelerationZ;
	float m_aafRot[3][3];
	float m_fYaw, m_fPitch, m_fRoll;
	float m_fYawVelocity, m_fPitchVelocity, m_fRollVelocity;
	float m_afSuspLength[2];
	float m_afSuspVelocity[2];
	int m_iCrashed;
	float m_fSteer;
	float m_fThrottle;
	float m_fFrontBrake;
	float m_fRearBrake;
	float m_fClutch;
	float m_afWheelSpeed[2];
	int m_aiWheelMaterial[2];
	float m_afBrakePressure[2];
	float m_fSteerTorque;
} SPluginsBikeData_t;

static SOCKET g_sock = INVALID_SOCKET;
static struct sockaddr_in g_addr;
static int wsa_ready = 0;
static SPluginsBikeEvent_t g_event;
static SPluginsBikeSession_t g_session;
static int g_have_event = 0;
static int g_have_session = 0;
static char g_json[2048];

static void json_escape(const char *src, char *dst, size_t dst_len)
{
	size_t o = 0;
	if (!src) src = "";
	for (; *src && o + 2 < dst_len; ++src) {
		char c = *src;
		if (c == '"' || c == '\\') {
			if (o + 3 >= dst_len) break;
			dst[o++] = '\\';
			dst[o++] = c;
		} else if ((unsigned char)c < 32) {
			continue;
		} else {
			dst[o++] = c;
		}
	}
	dst[o] = 0;
}

__declspec(dllexport) int Startup(char *_szSavePath)
{
	WSADATA wsa;
	char ini[MAX_PATH];
	char host[64];
	int port;

	(void)_szSavePath;

	memset(&g_event, 0, sizeof(g_event));
	memset(&g_session, 0, sizeof(g_session));
	g_have_event = 0;
	g_have_session = 0;

	if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
		return 2;
	}
	wsa_ready = 1;

	g_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
	if (g_sock == INVALID_SOCKET) {
		return 2;
	}

	{
		u_long nb = 1;
		ioctlsocket(g_sock, FIONBIO, &nb);
	}

	ini[0] = 0;
	GetModuleFileNameA(NULL, ini, MAX_PATH);
	{
		char *slash = strrchr(ini, '\\');
		if (slash) slash[1] = 0;
		strncat(ini, "plugins\\force_studio.ini", MAX_PATH - strlen(ini) - 1);
	}

	GetPrivateProfileStringA("force_studio", "host", "127.0.0.1", host, sizeof(host), ini);
	port = GetPrivateProfileIntA("force_studio", "port", 47387, ini);

	memset(&g_addr, 0, sizeof(g_addr));
	g_addr.sin_family = AF_INET;
	g_addr.sin_port = htons((u_short)port);
	if (inet_pton(AF_INET, host, &g_addr.sin_addr) != 1) {
		g_addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
	}

	/* Telemetry period: 1 ≈ 50 Hz (was 2 ≈ 20 Hz). Keep RunTelemetry cheap. */
	return 1;
}

__declspec(dllexport) void Shutdown(void)
{
	if (g_sock != INVALID_SOCKET) {
		closesocket(g_sock);
		g_sock = INVALID_SOCKET;
	}
	if (wsa_ready) {
		WSACleanup();
		wsa_ready = 0;
	}
}

__declspec(dllexport) void EventInit(void *_pData, int _iDataSize)
{
	(void)_iDataSize;
	if (!_pData) return;
	memcpy(&g_event, _pData, sizeof(SPluginsBikeEvent_t));
	g_have_event = 1;
}

__declspec(dllexport) void RunInit(void *_pData, int _iDataSize)
{
	(void)_iDataSize;
	if (!_pData) return;
	memcpy(&g_session, _pData, sizeof(SPluginsBikeSession_t));
	g_have_session = 1;
}

__declspec(dllexport) void RunTelemetry(void *_pData, int _iDataSize, float _fTime, float _fPos)
{
	SPluginsBikeData_t *d;
	char bike[128], rider[128], track[128], category[128], setup[128], bike_id[128];
	int n;

	(void)_iDataSize;
	if (!_pData || g_sock == INVALID_SOCKET) return;
	d = (SPluginsBikeData_t *)_pData;

	json_escape(g_have_event ? g_event.m_szBikeName : "250 4-stroke", bike, sizeof(bike));
	json_escape(g_have_event ? g_event.m_szBikeID : "250f", bike_id, sizeof(bike_id));
	json_escape(g_have_event ? g_event.m_szRiderName : "You", rider, sizeof(rider));
	json_escape(g_have_event ? g_event.m_szTrackName : "", track, sizeof(track));
	json_escape(g_have_event ? g_event.m_szCategory : "MX2", category, sizeof(category));
	json_escape(g_have_session ? g_session.m_szSetupFileName : "", setup, sizeof(setup));

	n = snprintf(
		g_json,
		sizeof(g_json),
		"{\"state\":2,\"event\":{\"riderName\":\"%s\",\"bikeId\":\"%s\",\"bikeName\":\"%s\",\"gears\":%d,\"maxRpm\":%d,\"limiter\":%d,\"shiftRpm\":%d,\"maxFuel\":%.3f,\"suspMaxTravel\":[%.4f,%.4f],\"steerLock\":%.2f,\"category\":\"%s\",\"trackId\":\"\",\"trackName\":\"%s\",\"trackLength\":%.2f},\"session\":{\"session\":%d,\"conditions\":%d,\"airTemperature\":%.2f,\"setupFileName\":\"%s\"},\"telemetry\":{\"rpm\":%d,\"engineTemp\":%.2f,\"waterTemp\":%.2f,\"gear\":%d,\"fuel\":%.3f,\"speedMs\":%.4f,\"position\":{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f},\"velocity\":{\"x\":%.4f,\"y\":%.4f,\"z\":%.4f},\"accelG\":{\"x\":%.4f,\"y\":%.4f,\"z\":%.4f},\"yaw\":%.3f,\"pitch\":%.3f,\"roll\":%.3f,\"yawRate\":%.3f,\"pitchRate\":%.3f,\"rollRate\":%.3f,\"suspLength\":[%.4f,%.4f],\"suspVelocity\":[%.4f,%.4f],\"crashed\":%s,\"steer\":%.3f,\"throttle\":%.4f,\"frontBrake\":%.4f,\"rearBrake\":%.4f,\"clutch\":%.4f,\"wheelSpeed\":[%.4f,%.4f],\"wheelMaterial\":[%d,%d],\"brakePressureKpa\":[%.2f,%.2f],\"steerTorqueNm\":%.3f,\"time\":%.4f,\"trackPos\":%.5f}}",
		rider,
		bike_id,
		bike,
		g_have_event ? g_event.m_iNumberOfGears : 5,
		g_have_event ? g_event.m_iMaxRPM : 14000,
		g_have_event ? g_event.m_iLimiter : 14400,
		g_have_event ? g_event.m_iShiftRPM : 12800,
		g_have_event ? g_event.m_fMaxFuel : 6.1f,
		g_have_event ? g_event.m_afSuspMaxTravel[0] : 0.31f,
		g_have_event ? g_event.m_afSuspMaxTravel[1] : 0.312f,
		g_have_event ? g_event.m_fSteerLock : 48.0f,
		category,
		track,
		g_have_event ? g_event.m_fTrackLength : 0.0f,
		g_have_session ? g_session.m_iSession : 1,
		g_have_session ? g_session.m_iConditions : 0,
		g_have_session ? g_session.m_fAirTemperature : 21.0f,
		setup,
		d->m_iRPM,
		d->m_fEngineTemperature,
		d->m_fWaterTemperature,
		d->m_iGear,
		d->m_fFuel,
		d->m_fSpeedometer,
		d->m_fPosX, d->m_fPosY, d->m_fPosZ,
		d->m_fVelocityX, d->m_fVelocityY, d->m_fVelocityZ,
		d->m_fAccelerationX, d->m_fAccelerationY, d->m_fAccelerationZ,
		d->m_fYaw, d->m_fPitch, d->m_fRoll,
		d->m_fYawVelocity, d->m_fPitchVelocity, d->m_fRollVelocity,
		d->m_afSuspLength[0], d->m_afSuspLength[1],
		d->m_afSuspVelocity[0], d->m_afSuspVelocity[1],
		d->m_iCrashed ? "true" : "false",
		d->m_fSteer,
		d->m_fThrottle,
		d->m_fFrontBrake,
		d->m_fRearBrake,
		d->m_fClutch,
		d->m_afWheelSpeed[0], d->m_afWheelSpeed[1],
		d->m_aiWheelMaterial[0], d->m_aiWheelMaterial[1],
		d->m_afBrakePressure[0], d->m_afBrakePressure[1],
		d->m_fSteerTorque,
		_fTime,
		_fPos
	);

	if (n > 0 && n < (int)sizeof(g_json)) {
		sendto(g_sock, g_json, n, 0, (struct sockaddr *)&g_addr, sizeof(g_addr));
	}
}

#ifdef __cplusplus
}
#endif
