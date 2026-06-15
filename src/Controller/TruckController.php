<?php

namespace App\Controller;

use App\Service\DriverService;
use App\Service\TruckService;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;

class TruckController extends BaseFleetController
{
    private $truckService;
    private $driverService;

    public function __construct(TruckService $truckService, DriverService $driverService)
    {
        $this->truckService  = $truckService;
        $this->driverService = $driverService;
    }

    /**
     * @Route("/trucks", name="fleet_trucks")
     */
    public function index(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $response = $this->truckService->getList(['count' => 100]);
        $trucks   = [];
        if (isset($response['data']['_embedded']['items'])) {
            $trucks = $response['data']['_embedded']['items'];
        } elseif (isset($response['data']) && is_array($response['data']) && !array_key_exists('page', $response['data'])) {
            $trucks = $response['data'];
        }

        // Truck status is binary (active/inactive) and the API soft-deletes by hiding
        // inactive rows, so filtering by status is not meaningful. Trucks are instead
        // filtered by inspection state, the fleet-relevant dimension.
        $inspectionFilter = $request->query->get('inspection', '');
        if (in_array($inspectionFilter, ['due', 'ok'], true)) {
            $threshold = new \DateTime('-1 year');
            $trucks = array_values(array_filter($trucks, function ($truck) use ($inspectionFilter, $threshold) {
                $raw = $truck['last_inspection_date'] ?? null;
                if (empty($raw)) {
                    $due = true;
                } else {
                    try {
                        $due = new \DateTime($raw) < $threshold;
                    } catch (\Exception $e) {
                        $due = true;
                    }
                }
                return $inspectionFilter === 'due' ? $due : !$due;
            }));
        }

        return $this->render('Fleet/trucks/index.html.twig', [
            'trucks'           => $trucks,
            'inspectionFilter' => $inspectionFilter,
        ]);
    }

    /**
     * @Route("/trucks/live-map", name="fleet_trucks_map")
     */
    public function liveMap(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        return $this->render('Fleet/trucks/live_map.html.twig');
    }

    /**
     * @Route("/trucks/new", name="fleet_truck_new", methods={"GET", "POST"})
     */
    public function new(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $error    = null;
        $formData = [];

        if ($request->isMethod('POST')) {
            $formData = [
                'truckNumber'        => $request->request->get('truckNumber', ''),
                'status'             => $request->request->get('status', '1'),
                'make'               => $request->request->get('make', ''),
                'model'              => $request->request->get('model', ''),
                'year'               => $request->request->get('year', ''),
                'plateNumber'        => $request->request->get('plateNumber', ''),
                'lastInspectionDate' => $request->request->get('lastInspectionDate', ''),
            ];

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->truckService->create($payload);

            if (!empty($result['data']) || (isset($result['outcome']) && $result['outcome'] === 'success')) {
                $this->addFlash('success', 'Truck created successfully.');
                return $this->redirectToRoute('fleet_trucks');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to create truck.';
        }

        return $this->render('Fleet/trucks/new.html.twig', [
            'error'    => $error,
            'formData' => $formData,
        ]);
    }

    /**
     * @Route("/trucks/{id}/edit", name="fleet_truck_edit", methods={"GET", "POST"})
     */
    public function edit($id, Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $truckResponse = $this->truckService->get($id);
        $truck         = isset($truckResponse['data']) ? $truckResponse['data'] : null;

        if (!$truck) {
            $this->addFlash('error', 'Truck not found.');
            return $this->redirectToRoute('fleet_trucks');
        }

        $error    = null;
        $formData = [
            'truckNumber'        => $truck['truck_number'] ?? '',
            'status'             => (string) ($truck['status'] ?? '1'),
            'make'               => $truck['make'] ?? '',
            'model'              => $truck['model'] ?? '',
            'year'               => $truck['year'] ?? '',
            'plateNumber'        => $truck['plate_number'] ?? '',
            'lastInspectionDate' => $truck['last_inspection_date'] ?? '',
        ];

        if ($request->isMethod('POST')) {
            $formData = [
                'truckNumber'        => $request->request->get('truckNumber', ''),
                'status'             => $request->request->get('status', '1'),
                'make'               => $request->request->get('make', ''),
                'model'              => $request->request->get('model', ''),
                'year'               => $request->request->get('year', ''),
                'plateNumber'        => $request->request->get('plateNumber', ''),
                'lastInspectionDate' => $request->request->get('lastInspectionDate', ''),
            ];

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->truckService->update($id, $payload);

            if (isset($result['outcome']) && $result['outcome'] === 'success') {
                $this->addFlash('success', 'Truck updated successfully.');
                return $this->redirectToRoute('fleet_trucks');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to update truck.';
        }

        // Available drivers (no truck assigned) for the assignment picker — only
        // needed when this truck currently has no driver.
        $availableDrivers = [];
        if (empty($truck['assigned_driver'])) {
            $availableResponse = $this->driverService->getAvailable();
            if (isset($availableResponse['data']) && is_array($availableResponse['data'])) {
                $availableDrivers = $availableResponse['data'];
            }
        }

        return $this->render('Fleet/trucks/edit.html.twig', [
            'truck'            => $truck,
            'formData'         => $formData,
            'error'            => $error,
            'availableDrivers' => $availableDrivers,
        ]);
    }

    /**
     * Assign a driver to this truck (the link is owned by the driver side).
     *
     * @Route("/trucks/{id}/assign-driver", name="fleet_truck_assign_driver", methods={"POST"})
     */
    public function assignDriver($id, Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $driverId = $request->request->get('driverId', '');
        if ($driverId === '') {
            $this->addFlash('error', 'Please select a driver to assign.');
            return $this->redirectToRoute('fleet_truck_edit', ['id' => $id]);
        }

        $result = $this->driverService->assignTruck($driverId, $id);
        if (isset($result['outcome']) && $result['outcome'] === 'success') {
            $this->addFlash('success', 'Driver assigned to truck.');
        } else {
            $this->addFlash('error', isset($result['message']) ? $result['message'] : 'Failed to assign driver.');
        }

        return $this->redirectToRoute('fleet_truck_edit', ['id' => $id]);
    }

    /**
     * Remove the driver currently assigned to this truck.
     *
     * @Route("/trucks/{id}/unassign-driver", name="fleet_truck_unassign_driver", methods={"POST"})
     */
    public function unassignDriver($id, Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $driverId = $request->request->get('driverId', '');
        if ($driverId === '') {
            $this->addFlash('error', 'No driver to unassign.');
            return $this->redirectToRoute('fleet_truck_edit', ['id' => $id]);
        }

        $result = $this->driverService->unassignTruck($driverId);
        if (isset($result['outcome']) && $result['outcome'] === 'success') {
            $this->addFlash('success', 'Driver unassigned from truck.');
        } else {
            $this->addFlash('error', isset($result['message']) ? $result['message'] : 'Failed to unassign driver.');
        }

        return $this->redirectToRoute('fleet_truck_edit', ['id' => $id]);
    }

    /**
     * @Route("/trucks/{id}/delete", name="fleet_truck_delete", methods={"POST"})
     */
    public function delete($id, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $this->truckService->delete($id);
        $this->addFlash('success', 'Truck deleted successfully.');
        return $this->redirectToRoute('fleet_trucks');
    }
}
