<?php

namespace App\Controller;

use App\Service\DriverService;
use App\Service\LoadService;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;

class LoadController extends BaseFleetController
{
    private $loadService;
    private $driverService;

    public function __construct(LoadService $loadService, DriverService $driverService)
    {
        $this->loadService   = $loadService;
        $this->driverService = $driverService;
    }

    /**
     * @Route("/loads", name="fleet_loads")
     */
    public function index(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $params = ['count' => 100];
        $statusFilter = $request->query->get('status', '');
        if ($statusFilter) {
            $params['status'] = $statusFilter;
        }

        $response = $this->loadService->getList($params);
        $loads    = [];
        if (isset($response['data']['_embedded']['items'])) {
            $loads = $response['data']['_embedded']['items'];
        } elseif (isset($response['data']) && is_array($response['data']) && !array_key_exists('page', $response['data'])) {
            $loads = $response['data'];
        }

        return $this->render('Fleet/loads/index.html.twig', [
            'loads'        => $loads,
            'statusFilter' => $statusFilter,
        ]);
    }

    /**
     * @Route("/loads/new", name="fleet_load_new", methods={"GET", "POST"})
     */
    public function new(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $error    = null;
        $formData = ['status' => 'pending'];

        if ($request->isMethod('POST')) {
            $formData = $this->readForm($request);

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->loadService->create($payload);

            if (!empty($result['data']) || (isset($result['outcome']) && $result['outcome'] === 'success')) {
                $this->addFlash('success', 'Load created successfully.');
                return $this->redirectToRoute('fleet_loads');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to create load.';
        }

        return $this->render('Fleet/loads/new.html.twig', [
            'error'    => $error,
            'formData' => $formData,
            'drivers'  => $this->getDrivers(),
        ]);
    }

    /**
     * @Route("/loads/{id}/edit", name="fleet_load_edit", methods={"GET", "POST"})
     */
    public function edit($id, Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $loadResponse = $this->loadService->get($id);
        $load         = isset($loadResponse['data']) ? $loadResponse['data'] : null;

        if (!$load) {
            $this->addFlash('error', 'Load not found.');
            return $this->redirectToRoute('fleet_loads');
        }

        $error    = null;
        $formData = [
            'referenceNumber' => $load['reference_number'] ?? '',
            'status'          => $load['status'] ?? 'pending',
            'origin'          => $load['origin'] ?? '',
            'destination'     => $load['destination'] ?? '',
            'pickupDate'      => $load['pickup_date'] ?? '',
            'deliveryDate'    => $load['delivery_date'] ?? '',
            'rate'            => $load['rate'] ?? '',
            'driver'          => isset($load['driver']['id']) ? $load['driver']['id'] : '',
        ];

        if ($request->isMethod('POST')) {
            $formData = $this->readForm($request);

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->loadService->update($id, $payload);

            if (isset($result['outcome']) && $result['outcome'] === 'success') {
                $this->addFlash('success', 'Load updated successfully.');
                return $this->redirectToRoute('fleet_loads');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to update load.';
        }

        return $this->render('Fleet/loads/edit.html.twig', [
            'load'     => $load,
            'formData' => $formData,
            'error'    => $error,
            'drivers'  => $this->getDrivers(),
        ]);
    }

    /**
     * @Route("/loads/{id}/delete", name="fleet_load_delete", methods={"POST"})
     */
    public function delete($id, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $this->loadService->delete($id);
        $this->addFlash('success', 'Load deleted successfully.');
        return $this->redirectToRoute('fleet_loads');
    }

    /**
     * Read the load form fields from the request into a normalized array.
     */
    private function readForm(Request $request): array
    {
        return [
            'referenceNumber' => $request->request->get('referenceNumber', ''),
            'status'          => $request->request->get('status', 'pending'),
            'origin'          => $request->request->get('origin', ''),
            'destination'     => $request->request->get('destination', ''),
            'pickupDate'      => $request->request->get('pickupDate', ''),
            'deliveryDate'    => $request->request->get('deliveryDate', ''),
            'rate'            => $request->request->get('rate', ''),
            'driver'          => $request->request->get('driver', ''),
        ];
    }

    /**
     * Company drivers for the assignment dropdown.
     */
    private function getDrivers(): array
    {
        $response = $this->driverService->getList(['count' => 100]);
        if (isset($response['data']['_embedded']['items'])) {
            return $response['data']['_embedded']['items'];
        }
        if (isset($response['data']) && is_array($response['data']) && !array_key_exists('page', $response['data'])) {
            return $response['data'];
        }
        return [];
    }
}
